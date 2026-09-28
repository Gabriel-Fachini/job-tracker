// Glassdoor extractor — runs INSIDE a logged-in glassdoor.com.br tab (javascript_tool).
// Uses only same-origin fetches (overview HTML + internal BFF endpoints), no navigation.
// Usage: paste this file, then `await collectGlassdoor({ employerIds: [<ID>], download: true })`
// Returns a short summary; the full payload lives in window.__jtGlassdoor and,
// with download:true, is saved as ~/Downloads/glassdoor-<slug>-<date>.json.
async function collectGlassdoor({
  employerIds,
  maxReviews = 500,
  maxInterviews = 200,
  maxSalaryPages = 10,
  delayMs = 800,
  download = true,
  // ISO date: reviews/interviews older than this are skipped (incremental monthly runs).
  // Ratings and salaries are always collected in full.
  since = null,
} = {}) {
  const SCHEMA_VERSION = 1;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms + Math.random() * 400));
  const BFF = "/bff/employer-profile-mono/";

  async function bff(path, body) {
    await sleep(delayMs);
    const res = await fetch(BFF + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      credentials: "include",
    });
    if (!res.ok) throw new Error(`${path} HTTP ${res.status}`);
    const json = await res.json();
    return Object.values(json.data || {})[0] || null;
  }

  // Next.js RSC payload -> one string, then pull balanced JSON values by key.
  function rscFrom(html) {
    return [...html.matchAll(/self\.__next_f\.push\(\[1,("(?:[^"\\]|\\.)*")\]\)/g)]
      .map((m) => {
        try { return JSON.parse(m[1]); } catch { return ""; }
      })
      .join("");
  }
  // `follow` disambiguates keys that appear more than once (e.g. '{"activeStatus"').
  function grab(text, key, follow = "") {
    const head = `"${key}":`;
    const start = text.indexOf(head + follow);
    if (start < 0) return null;
    const i = start + head.length;
    const open = text[i];
    if (open !== "{" && open !== "[") return null;
    const close = open === "{" ? "}" : "]";
    let depth = 0, inStr = false;
    for (let j = i; j < text.length; j++) {
      const c = text[j];
      if (inStr) {
        if (c === "\\") j++;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close && --depth === 0) {
        try { return JSON.parse(text.slice(i, j + 1)); } catch { return null; }
      }
    }
    return null;
  }

  // Both lists are sorted newest first, so the first old item ends pagination.
  const isNew = (field) => (item) => !since || (item[field] ?? "") >= since;
  const pct = (stats) =>
    Object.fromEntries((stats?.percentiles || []).map((p) => [p.ident.toLowerCase(), p.value]));
  const mapRatings = (r) =>
    r && {
      overall: r.overallRating ?? null,
      culture_values: r.cultureAndValuesRating ?? null,
      work_life_balance: r.workLifeBalanceRating ?? null,
      compensation_benefits: r.compensationAndBenefitsRating ?? null,
      career_opportunities: r.careerOpportunitiesRating ?? null,
      senior_management: r.seniorManagementRating ?? null,
      diversity_inclusion: r.diversityAndInclusionRating ?? null,
      recommend_to_friend: r.recommendToFriendRating ?? null,
      ceo_approval: r.ceoRating ?? null,
      business_outlook: r.businessOutlookRating ?? null,
    };

  async function collectOne(employerId) {
    const warnings = [];

    // 1. Overview (company metadata + ratings + benchmark + distribution)
    await sleep(delayMs);
    const ovRes = await fetch(`/Overview/W-EI_IE${employerId}.htm`, { credentials: "include" });
    if (!ovRes.ok) throw new Error(`overview HTTP ${ovRes.status}`);
    const rsc = rscFrom(await ovRes.text());
    if (!rsc) throw new Error("overview sem payload RSC (login/captcha?)");
    // Two partial `employer` objects: header (name, logo, website) + about card (revenue, type, founded).
    const emp = {
      ...(grab(rsc, "employer", '{"headquarters"') || {}),
      ...(grab(rsc, "employer", '{"activeStatus"') || {}),
    };
    const ratings = grab(rsc, "ratings", '{"businessOutlookRating"');
    const benchmark = grab(rsc, "industryBenchmarkRatings");
    const distribution = grab(rsc, "ratingCountDistribution");
    if (!ratings) warnings.push("ratings ausentes no overview");
    if (!emp.name && !emp.shortName) warnings.push("metadados da empresa ausentes no overview");

    // 2. Reviews (newest first, Portuguese + default criteria = what the site shows)
    const reviewBody = {
      worldwideFilter: false, useRowProfileTldForRatings: false, textSearch: "", sort: "DATE",
      reviewCategories: [], preferredTldId: 0, pageSize: 50, page: 1, overallRating: null,
      onlyCurrentEmployees: false, mlHighlightSearch: null, location: {}, language: "por",
      jobTitle: null, goc: null, enableKeywordSearch: false,
      employmentStatuses: ["REGULAR", "PART_TIME"], employerId, defaultLanguage: "por",
      applyDefaultCriteria: true,
    };
    const reviews = [];
    let reviewMeta = null;
    for (let page = 1; reviews.length < maxReviews; page++) {
      const d = await bff("employer-reviews", { ...reviewBody, page });
      if (!d) break;
      reviewMeta ??= d;
      const items = d.reviews || [];
      reviews.push(...items.filter(isNew("reviewDateTime")));
      if (items.some((v) => !isNew("reviewDateTime")(v))) break;
      if (items.length < reviewBody.pageSize || page * reviewBody.pageSize >= (d.filteredReviewsCount ?? 0)) break;
    }

    // 3. Interviews
    const interviews = [];
    let interviewMeta = null;
    for (let page = 1; interviews.length < maxInterviews; page++) {
      const d = await bff("employer-interviews", {
        sort: "DATE", page, outcome: [], location: {}, jobTitle: null, itemsPerPage: 50,
        goc: null, experiences: [], employerId,
      });
      if (!d) break;
      interviewMeta ??= d;
      const items = d.interviews || [];
      interviews.push(...items.filter(isNew("interviewDateTime")));
      if (items.some((v) => !isNew("interviewDateTime")(v))) break;
      if (items.length < 50 || page * 50 >= (d.filteredInterviewCount ?? 0)) break;
    }

    // 4. Salaries (all job titles, monthly)
    const salaries = [];
    let salaryMeta = null;
    for (let page = 1; page <= maxSalaryPages; page++) {
      const d = await bff("agg-salary-estimates", {
        sort: "UGC_SALARY_COUNT_DESC", sgoc: null, payPeriod: "MONTHLY", pageSize: 100, page,
        jobTitle: "", employerId,
      });
      if (!d) break;
      salaryMeta ??= d;
      salaries.push(...(d.results || []));
      if (page >= (d.numPages ?? 1)) break;
    }

    const r = ratings || reviewMeta?.ratings || {};
    return {
      employer: {
        glassdoor_id: employerId,
        name: emp.name ?? emp.shortName ?? null,
        overview_url: ovRes.url,
        logo_url: emp.squareLogoUrl ?? null,
        website: emp.website ?? null,
        headquarters: emp.headquarters ?? null,
        size: emp.size ?? null,
        revenue: emp.revenue ?? null,
        ownership: emp.type ?? null,
        year_founded: emp.yearFounded ?? null,
        industry: emp.primaryIndustry?.industryName ?? null,
        sector: emp.primaryIndustry?.sectorName ?? null,
      },
      ratings: {
        ...mapRatings(r),
        review_count: r.reviewCount ?? null,
        ceo: r.ratedCeo ? { name: r.ratedCeo.name, title: r.ratedCeo.title } : null,
        industry_benchmark: mapRatings(benchmark),
        distribution: distribution ?? null,
      },
      reviews: {
        total: reviewMeta?.filteredReviewsCount ?? null,
        all_languages_total: reviewMeta?.allReviewsCount ?? null,
        items: reviews.map((v) => ({
          id: v.reviewId,
          date: v.reviewDateTime,
          job_title: v.jobTitle?.text ?? null,
          location: v.location?.name ?? null,
          employment_status: v.employmentStatus ?? null,
          is_current: v.isCurrentJob ?? null,
          years_employed: v.lengthOfEmployment ?? null,
          rating: v.ratingOverall ?? null,
          sub_ratings: {
            culture_values: v.ratingCultureAndValues ?? null,
            work_life_balance: v.ratingWorkLifeBalance ?? null,
            compensation_benefits: v.ratingCompensationAndBenefits ?? null,
            career_opportunities: v.ratingCareerOpportunities ?? null,
            senior_management: v.ratingSeniorLeadership ?? null,
            diversity_inclusion: v.ratingDiversityAndInclusion ?? null,
          },
          recommend: v.ratingRecommendToFriend ?? null,
          ceo: v.ratingCeo ?? null,
          business_outlook: v.ratingBusinessOutlook ?? null,
          summary: v.summary ?? null,
          pros: v.pros ?? null,
          cons: v.cons ?? null,
          advice: v.advice ?? null,
          helpful: v.countHelpful ?? 0,
          has_employer_response: (v.employerResponses || []).length > 0,
        })),
      },
      interviews: {
        total: interviewMeta?.totalInterviewCount ?? null,
        difficulty_avg:
          interviewMeta?.difficultySubmissionCount
            ? +(interviewMeta.difficultySum / interviewMeta.difficultySubmissionCount).toFixed(2)
            : null,
        experience_counts: Object.fromEntries(
          (interviewMeta?.interviewExperienceCounts || []).map((c) => [c.type, c.count]),
        ),
        channel_counts: Object.fromEntries(
          (interviewMeta?.interviewObtainedChannelCounts || []).map((c) => [c.type, c.count]),
        ),
        items: interviews.map((v) => ({
          id: v.id,
          date: v.interviewDateTime,
          job_title: v.jobTitle?.text ?? null,
          location: v.location?.name ?? null,
          difficulty: v.difficulty ?? null,
          experience: v.experience ?? null,
          outcome: v.outcome ?? null,
          duration_days: v.durationDays ?? null,
          process: v.processDescription ?? null,
          questions: (v.userQuestions || []).map((q) => q.question).filter(Boolean),
        })),
      },
      salaries: {
        job_title_count: salaryMeta?.jobTitleCount ?? null,
        pay_period: "MONTHLY",
        location: salaryMeta?.queryLocation?.name ?? null,
        items: salaries.map((s) => ({
          job_title: s.jobTitle?.text ?? null,
          currency: s.currency?.code ?? null,
          count: s.salaryCount ?? null,
          most_recent: s.mostRecent ?? null,
          base: pct(s.basePayStatistics),
          total: pct(s.totalPayStatistics),
        })),
      },
      warnings,
    };
  }

  const companies = [];
  const errors = [];
  for (const id of employerIds) {
    try {
      companies.push(await collectOne(Number(id)));
    } catch (e) {
      errors.push({ glassdoor_id: Number(id), error: String(e?.message || e) });
    }
  }

  const payload = {
    schema_version: SCHEMA_VERSION,
    source: "glassdoor",
    collected_at: new Date().toISOString(),
    since,
    companies,
    errors,
  };
  window.__jtGlassdoor = payload;

  let file = null;
  if (download && companies.length) {
    const slug =
      companies.length === 1
        ? (companies[0].employer.name || String(companies[0].employer.glassdoor_id))
            .toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        : "full-scan";
    file = `glassdoor-${slug}-${payload.collected_at.slice(0, 10)}.json`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: "application/json" }));
    a.download = file;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  return {
    file,
    bytes: JSON.stringify(payload).length,
    companies: companies.map((c) => ({
      id: c.employer.glassdoor_id,
      name: c.employer.name,
      overall: c.ratings.overall,
      reviews: `${c.reviews.items.length}/${c.reviews.total}`,
      interviews: `${c.interviews.items.length}/${c.interviews.total}`,
      salaries: `${c.salaries.items.length}/${c.salaries.job_title_count}`,
      warnings: c.warnings,
    })),
    errors,
  };
}
