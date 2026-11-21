// Organization Intelligence: the organisation dashboard of Eligible Calls.
// Uses the page's loaded data through window.EC (index.html) and the API under /api/.
import { FIELDS, FIELD, ORG_TYPES, TARGET_GROUPS, SCOPES, EXPERIENCE, completeness } from "./schema.js";
import { assessAll, assess, buildDF, band, scoreTier, STATUS_ORDER, DEFAULT_WEIGHTS, HIGH, mandatorySummary, setGlossary, glossaryVersion } from "./rules.js";
import { TEXT_FIELDS, textHash, estTokens, nonStandardSerbian, serbianLexFix } from "./lang.js";
import { rubricFor, erasmusAction } from "./rubric.js";
import { templateFor, tplOf, unitsOf, checkDraft, documentModel, factsText, ERASMUS_FIELDS } from "./templates.js";
import { ideaIn as ideaInRaw, evalIn as evalInRaw, ideaTexts, evalTexts, applyIdeaTexts, applyEvalTexts } from "./content.js";

const EC = window.EC;
const esc = EC.esc;
const L = () => (EC.lang === "sr" ? "sr" : "en");
const nm = (o) => (o ? o[L()] || o.en : "");

/* ---------- text ---------- */
const S = {
  en: {
    title: "Organization Intelligence", lede: "A profile of your organisation, checked against every open call on Eligible Calls.",
    signinTitle: "Sign in to Organization Intelligence", signinLede: "Create a profile of your organisation, check its eligibility for the open calls and keep the results. Sign in with your Google account: Eligible Calls receives only your e-mail address from Google, never your password.",
    google: "Sign in with Google", acceptFirst: "Tick the privacy box first.", orEmail: "Or receive a sign-in link by e-mail",
    inviteNote: "They get access when they sign in with Google using this address.",
    email: "E-mail address", sendLink: "Send sign-in link", accept: (url) => `I agree that Eligible Calls stores my e-mail address and my organisation's profile to provide this service, as described in the <a href="${url}">privacy notice</a>.`,
    news: "Send me occasional news about new funding calls (optional; you can stop it any time).",
    linkSent: "Check your inbox: the link works once and expires in 20 minutes.", devLink: "Local development: e-mail is not sent. Use this link:",
    continueTitle: "Finish signing in", continueBtn: "Continue", linkInvalid: "This link is not valid any more (it was used, or it expired). Ask for a new one.",
    createTitle: "Create your organisation", createLede: "Start with the name. You can fill in the profile by hand, from documents, or from your website.", orgName: "Organisation name", create: "Create",
    nav: { overview: "Overview", profile: "Organisation profile", documents: "Documents and sources", matching: "Eligibility matching", ideas: "Project ideas", evaluation: "Evaluation guidelines", reports: "Saved reports", settings: "Settings" },
    soon: "next phase", newOrg: "+ New organisation", signOut: "Sign out",
    complete: "Profile completeness", analysed: "Open calls analysed", high: "Highly compatible (70%+)", eligibleN: "Eligible on available information",
    missingTitle: "Missing information", missingNone: "Every field that counts for matching is filled in.", strengthsTitle: "Strengths seen in the profile",
    upcoming: "Upcoming deadlines of compatible calls", none: "None yet.", lastUpdate: (d, v) => `Profile version ${v}, saved ${d}.`, recentRuns: "Recent extractions",
    fillProfile: "Fill in the profile", openMatching: "See all matches",
    save: "Save profile", saved: (v) => `Saved as version ${v}.`, unsaved: "Unsaved changes", conflict: "Someone else saved the profile in the meantime. Reload to see their version; your changes are kept in this form.", reload: "Reload",
    invalid: "Some fields are not valid; they are marked below.", viewerNote: "You can view this organisation. Only editors and owners can change it.",
    sections: { identity: "Identity", about: "Mission and activities", experience: "Experience", capacity: "Capacity and resources", partners: "Partnerships" },
    prov: { manual: "entered by hand", document: "from document", web: "from website" }, unverified: "auto-filled: please check", verifiedBy: "approved",
    yes: "Yes", no: "No", unknown: "Not stated",
    docsTitle: "Documents and sources", docsLede: "Upload a statute, registration certificate, annual report or project document (also scanned, in Cyrillic or Latin script), or name your website. The text is read in your browser, with OCR for scans, and sent once to the AI model; the file itself is not stored. Values found with clear evidence fill empty profile fields automatically, each marked with its source. Values that differ from the profile are shown for you to decide.",
    upload: "Choose a document or scan", reading: "Reading the document…", sending: (i, n) => `Analysing part ${i} of ${n}…`, jobOpen: "Review the values found", jobDocs: "Documents and sources", jobClose: "Close", jobBusy: "A document is still being read. Wait until it is finished, then upload the next one.", aiWait: (i, n, s) => `Part ${i} of ${n}: the AI service's per-minute limit is reached, trying again in ${s} s…`, scanned: "No text could be read from this file. Type the facts in the profile, or try another copy of the document.",
    tooLong: (n, max) => `The document is long: only the first ${max} parts (${n} characters) are analysed.`,
    aiLeft: (l, n, t) => `AI actions left today: ${l} of ${n} (renewed at ${t})`, partCached: (i, n) => `Part ${i} of ${n} was read before: no AI action used.`,
    docNeeds: (n, l) => `This document has ${n} parts and needs up to ${n} AI actions; you have ${l} left today. Parts read before need none.`,
    docCached: (c, n) => `${c} of ${n} parts came from an earlier reading of the same text (no AI actions used).`,
    docResume: "The parts read so far are kept: upload the same file again after the renewal and they will not use AI actions.",
    webTitle: "Read from your website", webLede: "We read the page you name and up to two linked pages about the organisation (\"About us\", \"Mission\", \"Projects\"), on the same site, respecting robots.txt. Only facts that are quoted from those pages are proposed.", url: "Website or page address", readSite: "Read website",
    review: "Review proposed fields", reviewLede: "Each value comes with the sentence it was taken from. Values that are not clearly supported by their quote, or that the profile already has, start unticked; check them yourself. Lists are added to what the profile already has.",
    field: "Field", proposed: "Proposed value", current: "Current value", evidence: "Source quote", conf: "Confidence", found: "Quote found in source", notFound: "Quote NOT found in source", valueNotInQuote: "Quote found, but the value is not written in it", weakQuote: "Quote found, but it does not clearly state this value", adds: (v) => `Adds: ${v}`, alreadyHas: "Already in the profile", same: "Same as the profile",
    apply: "Apply selected to profile", discard: "Discard", applied: (n) => `${n} field(s) added to the profile.`, runs: "Earlier extractions", status: { review: "to review", applied: "applied", discarded: "discarded" }, del: "Delete", open: "Open",
    confL: { high: "high", medium: "medium", low: "low" }, dropped: (n) => `${n} proposed value(s) were removed because they were invalid or contained personal data.`, noQuote: (n) => `${n} value(s) without a quote from the source were left out.`,
    matchTitle: "Eligibility matching", matchLede: (n, d) => `${n} open and upcoming calls checked against your organisation profile, with call data of ${d}.`,
    mxStatusT: "Mandatory eligibility", mxStatus: "Can you apply? Country, type of organisation, consortium and the conditions read from each call's official documents. One unmet condition makes a call not eligible, whatever its percentage; a condition that could not be verified is shown as to verify.",
    mxScoreT: "Strategic compatibility", mxScore: "How well the call fits your mission, experience, target groups and capacity. It helps you choose between calls you can apply to; it never overrides the status.",
    legendL: { low: "Low", medium: "Medium", high: "High" }, filtersT: "Filter and sort", resetF: "Reset filters", compatK: "Compatibility", mreq: (p, v, f) => `${p} met · ${v} to verify · ${f} not met`,
    scoreLegend: "Fit with your work: red 0–49%, yellow 50–69%, green 70–100%.", tierL: { high: "70–100%", medium: "50–69%", low: "0–49%" },
    notice: "Both results come from rules applied to your profile and the call data. They are not a legal decision and not a chance of funding: the call's official documents always prevail.",
    fStatus: "All statuses", fProg: "All programmes", fDl: "Any deadline", dl30: "Next 30 days", dl60: "Next 60 days", dl120: "Next 120 days", onlyHigh: "Only 70%+", sortScore: "Sort: compatibility", sortDl: "Sort: deadline",
    showing: (n, m) => `${n} of ${m} calls`, more: "Show more", strengths: "Strengths", problems: "Possible problems", missing: "Missing information", next: "Next step", report: "Detailed assessment", official: "Official page",
    deadline: "Deadline", funding: "Funding", notStated: "No requirement stated", missingCall: "The profile has the information this assessment uses for this call.", perGrant: "per grant", topicBudget: "total budget of the topic", programme: "Programme", noCountry: "Add your country and organisation type to the profile: without them no call can be checked.",
    statusL: { eligible: "Eligible based on available information", potential: "Potentially eligible: verification required", ineligible: "Ineligible: mandatory requirement not met", insufficient: "Insufficient information" },
    bandL: { high: "High compatibility", medium: "Medium compatibility", excellent: "Excellent compatibility", strong: "Strong compatibility", moderate: "Moderate compatibility", low: "Low compatibility", verylow: "Very low compatibility" },
    repA: "Overall assessment", mandT: "Mandatory eligibility: can you apply?", stratT: "Strategic compatibility: how well does it fit?", stratWhat: "Weighted fit of the call with your mission and areas of activity, experience, target groups, capacity and partnerships. Country and organisation type are not part of it: they decide the status.", offT: "Official eligibility documentation", offLede: "The mandatory conditions above that are marked as an official call document come from this source. Eligible Calls reads the eligibility section of the call document (or the funder page) and keeps the quoted sentence of every condition.", offPub: "Publisher", offDoc: "Document", offPublished: "Published", offVerified: "Last verified", offNone: "No official eligibility document is read for this call.", aiT: "AI check against the official text", aiLede: "The AI lists every mandatory condition in the official text, quotes it, and checks your profile against it. Only conditions whose quote is found in the official text are kept; a result that does not rest on a filled profile field is shown as to verify. The results count in the eligibility status. The check runs on its own the first time an editor opens the report of this call; after the profile changes, run it again with the button.", aiRun: "Check my profile against the official text", aiRerun: "Check again", aiStale: (v) => `Made with profile version ${v}; your profile has changed since. Run the check again to update the status.`, aiNoText: "There is no official text for an AI check of this call.", aiApplies: { applicant: "applicant", coordinator: "coordinator", consortium: "consortium", all: "all participants" }, aiMade: (t) => `Checked ${t}`, aiCounts: "These results count in the status above.", repB: "Requirements checked", repB2: "Compatibility by dimension", repC: "Organisational strengths", repD: "Eligibility gaps", repE: "Missing information", repF: "Recommendations",
    requirement: "Requirement", result: "Result", basis: "Basis", weight: "Weight", part: "Score",
    resL: { pass: "Met", fail: "Not met", warn: "Possible problem", unknown: "To verify", missing: "Profile data missing" },
    srcL: { official: "official call document", "official-ai": "official document, AI-checked", "programme-list": "Commission list of participating countries", call: "call text", source: "source of the call", derived: "Eligible Calls rules on the call text", "call-rule": "official text quoted", none: "source data" },
    capNote: "Score limited because the call shares little with your areas and objectives.",
    assessedAt: (d, v, g) => `Assessed ${d} on profile version ${v} and call data of ${g}. The assessment is recalculated whenever the profile or the call data change.`,
    explain: { eligible: "No mandatory requirement fails on the information available, and every checked requirement is met.", potential: "No mandatory requirement fails, but some need to be verified in the call document or need more profile data.", ineligible: "At least one mandatory requirement is not met. The compatibility score is shown for information only.", insufficient: "Country and organisation type are needed before eligibility can be checked." },
    dims: { orgType: "Organisation type and legal status", country: "Country and geographic eligibility", objectives: "Alignment with funding objectives", experience: "Experience and previous projects", targetGroups: "Target groups and beneficiaries", capacity: "Operational and administrative capacity", partnerships: "Partnerships and international cooperation" },
    evalTitle: "Evaluation guidelines", evalLede: "How proposals are scored, taken from the official documents: Horizon Europe's General Annex D, each call's own call document, the funder's call page, and the Erasmus+ Programme Guide. Eligibility (can we apply?) and quality (would evaluators score the proposal well?) are separate questions: an eligible organisation can still submit a weak proposal.",
    evalTabCalls: "By call", evalCallsNote: "Your open calls, most compatible first. Criteria are quoted in English, the language of the official documents; the call's own documents prevail.", progL: "Programme",
    evalShowIneligible: "Also show calls you cannot apply to", evalCount: (n, k) => `${n} calls; for ${k} of them the criteria are shown here, for the others the call says where to find them.`,
    kindL: { framework: "General Annex D", document: "Call document", page: "Funder's page", pointer: "See the call" }, openReport: "Detailed report",
    critNone: "No information on evaluation criteria for this call.", fromCallPage: "Specific to this call (call page):",
    critFromAnnex: (row) => `Horizon Europe General Annex D, row "${row}".`, heAnnex: "General Annex D", critFromDoc: "Section \"Award criteria\" of the call document", callDoc: "Call document", evalForm: "Evaluation form",
    critFromPage: (src) => `${src} call page, section "How we will assess your application".`, critPointer: "The criteria are not published in a form this site can read. They are in the call's own documents.", critPointerNote: "The call page says where its criteria are:",
    criterion: "Criterion", minPass: "Minimum", maxScore: "Maximum", fullText: "Full text of the criteria",
    scoreOf5: "scored 0–5", iaWeight: "Impact weighted ×1.5 for ranking (Innovation actions)", heThresholds: "Each criterion 0–5 · threshold 3 · overall threshold 10 of 15", twoStageChip: "Two-stage call",
    stage1Short: "1st stage", stage1Mark: "Also assessed in the first stage of a two-stage call (bold in the annex)", stage1Note: "In the first stage of a two-stage call only Excellence and Impact are scored, on the aspects marked \"1st stage\", with a threshold of 4 each.",
    heScoringTitle: "Scores and thresholds", heTwoStageTitle: "Two-stage calls", openCallsUsing: (n) => `Open calls on Eligible Calls scored this way: ${n}.`,
    heOwn: "Marie Skłodowska-Curie Actions, the European Research Council, the European Innovation Council, prizes and some partnership calls use their own criteria; their calls point to them under \"By call\".",
    retrieved: (d) => `retrieved ${d}`, repEval: "How this call is evaluated", critNotice: "Preliminary self-assessment aid. The work programme and the call's own documents prevail.",
    guide: (y, v) => `Programme Guide ${y}, ${v}`, guideNotice: "Preliminary self-assessment aid. Evaluators score against the official guide of the call year; the guide prevails.", maxPts: (m, n) => `max ${m} points · minimum ${n}`, totalMin: (n) => `Proposals need at least ${n} points in total and at least half of the maximum in each criterion.`,
    rounds: "Deadlines in this guide (national agencies)", optional: "if the national agency organises it", where: "Apply to the Erasmus+ national agency of your country.", na: "National agencies",
    ideasTitle: "Project ideas", ideasLede: "Concepts for projects your organisation could develop, each linked to an open call listed on Eligible Calls. An AI model writes them from your saved profile and the calls you select; the calls, deadlines, eligibility and compatibility scores come from the platform's data and rules.",
    ideasAi: "AI-generated proposal: check it against the call documents before relying on it.", ideasPick: "Calls to build ideas on", ideasPickNote: (n) => `Your most compatible open calls: eligible or to verify, with a score of 50% or more. Up to ${n} can be used in one run.`,
    ideasNoCalls: "No open call reaches 50% compatibility with the profile yet. Complete the profile or look at the matching page.", ideasNeed: "To generate ideas the profile needs a name, organisation type, country, and a description, mission or objectives.",
    ideasGenerate: "Generate ideas", ideasRegenerate: "Generate new ideas", ideasBusy: "Writing one idea for each selected call… about 20 seconds per call.", ideasUse: "Each selected call uses 1 of your daily AI actions. Generating again replaces the earlier suggestions you did not save; saved ideas are kept.",
    ideasDone: (n, k) => `${n} idea(s) generated for ${k} selected call(s).`, ideasZero: "No idea could be generated for the selected calls.",
    ideasMissing: "No idea for:", ideasRetry: "To try these calls again, save the ideas you want to keep first: generating again replaces unsaved suggestions.",
    ideaWhy: { closed: "the call is closed", not_eligible: "organisations from your country cannot apply", unknown_call: "the call is no longer published", too_many: "more than 6 calls were selected", no_fit: "the AI found that the organisation cannot take part in this call", incomplete: "the AI answer was incomplete", ai_bad_answer: "the AI answer could not be read", ai_user_limit: "your AI actions for today are used up", ai_resting: "the AI allowance for today is used up", ai_busy: "the AI service was busy", ai_unavailable: "the AI service did not answer" },
    ideasNone: "No ideas yet.", ideasSaved: "Saved ideas", ideasSuggested: "Latest suggestions", ideasViewerNote: "You can read the ideas. Editors and owners generate, save and annotate them.",
    ideaSavedChip: "Saved", ideaSave: "Save", ideaUnsave: "Remove from saved", ideaNotes: "Notes", ideaNotesSave: "Save notes", ideaNotesSaved: "Notes saved.", ideaCompare: "Compare", ideaDelete: "Delete",
    ideaF: { concept: "Project concept", problem: "Problem addressed", solution: "Proposed solution", objectives: "Main objectives", targetGroups: "Target groups", activities: "Proposed activities", expectedResults: "Expected results and impact", potentialPartners: "Potential partners", whyItFits: "Why this project makes sense", methodology: "Methodology", workPlan: "Work plan", impactPathway: "Pathway to impact", dissemination: "Dissemination, exploitation and communication", management: "Management, resources and risks" },
    fitExplainT: "Why this estimate", fitStrengths: "What fits", fitWeak: "What is weak or missing", fitImprove: "To raise the fit", fitExplainRun: "Explain this estimate", ideaCall: "Matching funding opportunity", compatRule: "Organisation–call compatibility (rules)", conceptFitL: "Concept fit (AI estimate)", fitTitle: "AI ratings (1–5)",
    fitL: { alignment: "Alignment with the call", priorities: "Programme priorities", feasibility: "Feasibility", impact: "Potential impact" },
    ideaStale: (v) => `Generated from profile version ${v}; the profile has changed since.`, ideaClosed: "This call is no longer open.", ideaGen: (d, sc) => `Generated ${d}; compatibility at that time ${sc}%.`,
    compareTitle: "Comparison", compareHint: "Tick Compare on two or three ideas to see them side by side.", compareMax: "You can compare up to three ideas.", savedIdeasN: "Saved project ideas",
    reportsTitle: "Saved reports", reportsSoon: "Saving and exporting reports comes with the evaluation assistant (next phase). Assessments are recalculated live on the matching page.",
    settingsTitle: "Settings", members: "Members", invite: "Add a member by e-mail", role: "Role", roles: { owner: "Owner", editor: "Editor", viewer: "Viewer" }, add: "Add",
    invited: "Invited (not signed up yet)", remove: "Remove", leave: "Leave this organisation", versions: "Profile history", changedF: "Changed fields", by: "by",
    account: "Your account", newsToggle: "News e-mails", deleteAccount: "Delete my account", deleteAccountNote: "Deletes your account, your sign-in sessions and the organisations where you are the only member.", deleteAccountConfirm: "Yes, delete my account permanently", cancel: "Cancel", signedInAs: (e) => `Signed in as ${e}`,
    deleteOrg: "Delete this organisation", deleteOrgNote: (n) => `Deletes the profile, its history and all extraction results. Type the organisation name (${n}) to confirm.`, confirmDel: "Delete permanently",
    savedReportsN: "Saved reports", goReports: "Open saved reports",
    repSaveTitle: "Save this report", repSaveLede: "Keeps this assessment as it is now, with the profile version and the call data date, so you can return to it, compare it later and download it as PDF.",
    repNote: "Note", repNotePh: "e.g. discussed with the board, apply in March", repSave: "Save report", repSaved: "Report saved.", repOpenSaved: "Open in Saved reports",
    reportsLede: "Eligibility reports saved from the matching page. Each one keeps the assessment as it was when saved; the Now column shows today's score for the same call and profile.",
    reportsEmpty: "No saved reports yet. Open a call in Eligibility matching and press Save report.", reportsSearch: "Search in call names and notes",
    repCsv: "Download list (CSV)", repColSaved: "Saved", repColCall: "Call", repColScore: "Score then", repColStatus: "Status then", repColNow: "Now",
    repCallGone: "The call is no longer in the published data.", repSavedAt: (t) => `Saved ${t}`, repProfileV: (v) => `profile version ${v}`, repProfileNow: (v) => `(now ${v})`, repDataDate: (d) => `call data of ${d}`,
    repNoteSave: "Save note", repNoteSaved: "Note saved.", repPdf: "Download report (PDF)", repDelete: "Delete report", repDeleteConfirm: "Click again to delete",
    repChange: "Since this report was saved", repThen: "Saved", repNow: "Now", repNewCheck: "new check", repSameResult: "All requirements have the same result as when the report was saved.",
    repOpenCurrent: "Open the current report", repSavedVersion: "Saved report", repPdfFooter: "preliminary self-assessment, the call documents prevail",
    goComplete: "Fill in missing fields", goProfile: "Edit profile", goList: "Show the calls", goIdeas: "Open saved ideas",
    missingHere: (n) => `${n} field${n === 1 ? " is" : "s are"} still empty. They are marked below.`, orFromDocs: "Or fill them from a document",
    ocrLoading: "Loading text recognition (OCR) for Serbian Cyrillic, Serbian Latin and English. The first time takes a little longer.",
    readingPage: (i, n) => `Reading page ${i} of ${n}…`, ocrPage: (i, n) => `Recognising text on page ${i} of ${n} (OCR)…`,
    ocrDone: (n) => `Text recognised by OCR on ${n} page${n === 1 ? "" : "s"}.`, ocrLow: (n) => `${n} page${n === 1 ? " was" : "s were"} hard to read; check the filled values.`,
    ocrEmpty: "OCR found almost no text in this file. Try a sharper scan (at least 300 dpi), or type the facts in the profile.",
    ocrUnavailable: "Text recognition could not be loaded. Check the connection and try again.", badType: "This file type is not supported.",
    uploadFormats: "PDF (text or scanned), JPG, PNG, TIFF, DOCX or TXT. Cyrillic and Latin script are both read.",
    readingSite: "Reading the website…", filling: "Filling the profile…",
    notFilledYet: "The data from this source has not been applied to the profile yet.", fillNow: "Fill the profile",
    filledFrom: (s) => `Filled from: ${s}`, filledN: (n) => `${n} field${n === 1 ? "" : "s"} filled.`,
    conflictsN: (n) => `${n} value${n === 1 ? " differs" : "s differ"} from the profile and ${n === 1 ? "was" : "were"} not changed.`,
    notAppliedN: (n) => `${n} uncertain value${n === 1 ? " was" : "s were"} not used.`,
    filledValue: "Value now in the profile", addedToList: "added to the list", replaced: (v) => `before: ${v}`,
    conflictsTitle: "Different from the profile", conflictsLede: "The profile already has another value. Nothing was overwritten; choose which one to keep.",
    foundValue: "Found in the source", useFound: "Use found value", keepCurrent: "Keep current",
    notAppliedTitle: (n) => `Uncertain values not used (${n})`, useAnyway: "Use anyway",
    why: { low_confidence: "The model was not sure.", quote_not_found: "The quoted text was not found in the source.", value_not_in_evidence: "The value does not appear in the quoted text.", weak_evidence: "The quoted text only weakly supports the value." },
    reviewProfile: "Check the profile", autoNote: "Filled fields are marked with their source and stay editable.",
    runSummary: (f, c) => `${f} filled · ${c} to decide`,
    evTitle: "Evaluation against the call's criteria (indicative)", evLede: "Scores the idea against the award criteria of the call it targets, as published in that call's documentation (Horizon Europe General Annex D, the call document, the funder's assessment page, or the Erasmus+ Programme Guide). AI-assisted and indicative only; the official assessment is done by the funder's experts.",
    evWill: "Criteria used:", evCritList: (l) => `scored on ${l}`, evShown: "Evaluation shown", evRerun: "Evaluate again", evShortDoc: "Call criteria", evShortText: "Funder criteria",
    evNoCriteria: "The award criteria of this call are not in our data (the funder publishes them only in documents we cannot read), so the idea cannot be evaluated here. Check the call's own documents:",
    evTextScale: "the funder states no point scale: each criterion is scored 0 to 5 as an indication", evNoThreshold: "No threshold stated", evNoTotal: "the documentation states no overall threshold", evBasis: "Basis", evSourceDoc: "Call documentation",
    evRun: "Evaluate", evBusy: "Evaluating against the call's award criteria…", evDone: "Evaluation saved.",
    evPass: "Above the thresholds", evFail: "Below a threshold",
    evStrengths: "Strengths", evWeak: "Weaknesses", evMissing: "Missing elements", evRec: "Recommendations",
    evNoMin: (names) => `No individual minimum for ${names}: the call document states none ("n/a"), so these criteria count only towards the overall threshold.`,
    evAuto: (i, n) => `idea ${i} of ${n}`, evAutoDone: (n, f) => `Evaluated automatically: ${n} idea(s), ${f} below a threshold.`, evAutoRevised: (n, ok) => `${n} idea(s) below the threshold were revised using their evaluation; ${ok} now pass.`, improveRun: "Revise the idea using this evaluation", improveBusy: "Revising the idea using the evaluation…", revised: (n, t, m) => `Revised version ${n}, written to the evaluation of the earlier version (${t} / ${m}).`, trNeeded: "Part of this idea or its evaluation was written in Serbian.", trRun: "Show in English", trBusy: "Translating…", evNoteQuoted: "From the call document:", evAutoStop: "Automatic evaluation stopped:", evAutoMore: (n) => `${n} more idea(s) can be evaluated with the Evaluate button on their cards.`, evSame: "Nothing has changed since the last evaluation, so the saved result is shown.",
    evAutoPremium: "Ideas are evaluated automatically with premium access; without it, the evaluation stays empty.", evAutoNone: "The award criteria of the selected calls are not in our data, so no idea could be evaluated automatically.",
    ideasBelow: "Below the evaluation threshold", ideaBelowChip: "Below the evaluation threshold", pickBelow: "your last idea for this call was below the evaluation threshold",
    ideasBelowNote: "The indicative evaluation scored these concepts below the threshold of their call, so they are not recommended as written. They stay here so you can revise them and evaluate again; the call itself may still suit your organisation with a different concept.",
    conceptFitBasis: "Estimated by the AI when the idea was written, from your saved profile and the call's description (title, programme, eligibility, funding and an excerpt of the call text). It rates this concept, not the organisation; the proposal PDF is not used.",
    evalTabsNote: "Horizon Europe (General Annex D) and Erasmus+ KA210 and KA220 (Programme Guide) score every call with one set of criteria, so each has its own tab. Other programmes set their criteria in each call's own document; choose them under \"By call\" with the programme filter.",
    evThreshold: (t, m) => `funding threshold ${t} of ${m} points`,
    evGuide: (y, v) => `Programme Guide ${y}${v ? ", " + v : ""}`, evUsedProposal: "uses the detailed proposal",
    evScore: "Score", evTotal: "Total", evPriority: "What to improve first",
    evDisclaimer: "AI-assisted indicative evaluation. It is not an official score and does not predict the funder's decision.",
    evMade: (t) => `Evaluated ${t}`,
    premiumTag: "Premium", premiumNeeded: "The detailed PDF and the evaluation are premium features.", premiumHow: "How to get access",
    premiumUntil: (t) => `Premium access active until ${t}.`,
    ideaMore: "Problem addressed, main objectives, activities and expected results", ideaMoreHint: "Open to read the full idea: solution, target groups, potential partners and why it fits the call.",
    pdfCreate: "Create detailed proposal (PDF)", pdfDownload: "Download proposal (PDF)", pdfRegenerate: "Write the proposal again",
    pdfBusy: "Writing the detailed proposal. This takes up to a minute…", pdfDrawing: "Preparing the PDF…", pdfDone: "PDF downloaded.", pdfFail: "The PDF could not be created. Try again.",
    pdf: { applicant: "Applicant", call: "Call", deadline: "Deadline", duration: "Duration", months: "months", made: "Prepared",
      disclaimer: "Draft prepared with AI assistance from the organisation profile and the call data. Check every fact, number and rule against the call documents before using it in an application. Text marked \"(to be confirmed)\" needs your input.",
      tbc: "(to be confirmed)", concept: "Project concept", problem: "Problem and needs analysis", mainObjectives: "Main objectives", specificObjectives: "Specific objectives",
      targetGroups: "Target groups and beneficiaries", group: "Group", description: "Description", reach: "Reach",
      workPackages: "Activities and work packages", period: "Period", lead: "Lead", activities: "Activities", deliverables: "Deliverables",
      methodology: "Methodology", outputs: "Expected outputs and results", output: "Output", indicator: "Indicator", target: "Target", impact: "Impact",
      partnership: "Partnership", partnerProfile: "Partner profile", country: "Country", role: "Role",
      timeline: "Timeline", phase: "Phase", milestones: "Milestones", monitoring: "Monitoring and evaluation", sustainability: "Sustainability",
      risks: "Risks and mitigation", risk: "Risk", likelihood: "Likelihood", mitigation: "Mitigation", lk: { low: "low", medium: "medium", high: "high" },
      alignment: "Alignment with the call and programme priorities", budget: "Indicative budget structure", requested: "Requested amount", callMax: "call maximum",
      noTotal: "The call states no amount per project; the structure below is in shares of the total.", category: "Category", share: "Share", indicative: "Indicative amount", noteCol: "Note",
      footer: "AI-assisted draft, check before use" },
    app: {
      title: "Full application", follows: "Follows the official structure",
      basisCriteria: "This call's official application form is not in our data, so the structure follows the call's award criteria. Check the call's own form and move the text into it.",
      basisGeneral: "This call's official application form and award criteria are not in our data, so the text follows a general project structure. Check the call's own form and move the text into it.", premium: "Writing the full application is a premium feature.",
      lede: "Writes the whole application in the order of the official template, part by part, from your profile, this idea and the details below. Tables, months and amounts are made from one plan, so they match everywhere. You review it, fill in what is marked, and submit it yourself on the official portal.",
      start: "Write the full application", open: "Open the application", hide: "Close the application", cont: "Continue writing", again: "Write again with new details",
      againWarn: "Writing again replaces the current text, including your edits. Continue?", partsWritten: (n) => `${n} part(s) written so far.`,
      pdf: "Download PDF", docx: "Download Word (.docx)", earlier: "Download the earlier short proposal (PDF)",
      fTitle: "Details for the application", fNote: "What you enter here is used as fact. Whatever is missing is written as \"(to be confirmed)\" so you can fill it in later. Nothing is invented about your organisation or partners.",
      fLang: "Language of the application", fLangHe: "Horizon Europe proposals are normally written in English.", fLangEp: "The Erasmus+ form also asks for the project summary in English; it is written as well.",
      fDur: "Duration (months)", fAmount: "Requested EU contribution (EUR)", fAmountMax: (m) => `The call states up to ${m} EUR per project.`, fLump: "Lump sum (EUR)", fLumpPick: "Choose…",
      fLumpTopic: "This topic uses lump sum funding (page limit is higher)", fField: "Field", fRole: "Our role", fCoord: "Coordinator", fPartner: "Partner",
      fTrl: "Technology readiness level (optional)", fTrlStart: "at the start", fTrlEnd: "at the end",
      fPartners: "Partners, one per line", fPartnersPh: "Name | Country | Type | Expertise and role in the project", fPartnersHint: (n) => `The programme needs at least ${n} organisations, including yours, from ${n} different countries. Missing partners are shown as places to fill in.`,
      fTeam: "Team and key staff (roles, expertise; no personal data you do not want in the text)", fTrack: "Previous projects and results of your organisation and partners", fExtra: "Other facts the text must use (pilots, data, infrastructure, letters of support, policy links)",
      fGo: "Write the application", fCancel: "Cancel", fields: { school: "School education", vet: "Vocational education and training", adult: "Adult education", youth: "Youth", higher: "Higher education" },
      planning: "Planning objectives, work packages, deliverables and amounts…", writing: (i, n, t) => `Part ${i} of ${n}: ${t}`, busyWait: (s) => `The AI is busy (free tier, per-minute limit). Trying again in ${s} s…`,
      done: "All parts are written. Review them below, fill in what is marked, then download.", stopped: "Writing stopped. Written parts are kept; press Continue writing to finish.",
      checks: "Checks done by the platform", unitMissing: "not written yet", edited: "edited by you", chars: (n) => `${n.toLocaleString("en-GB")} characters`,
      edit: "Edit", save: "Save", cancel: "Cancel", rewrite: "Write this part again", copy: "Copy", copied: "Copied.", saved: "Saved.", rewriteWarn: "Writing this part again replaces its text, including your edits. Continue?",
      formLimits: "The online form shows the character limit of each field; compare it with the length shown here.",
      declaration: "The Erasmus+ form asks the applicant to confirm that the application contains original content authored by the applicant organisation. Treat this text as a draft: rewrite it in your own words and check every statement.",
      heNote: "Part A (participants, budget table, ethics and security) is filled in directly on the Funding & Tenders Portal; this document is Part B.",
      doc: { acronym: "Acronym", call: "Call", template: "Template", duration: "Duration", months: "months", requested: "Requested EU contribution", lumpSum: "Lump sum",
        disclaimer: "Draft prepared with AI assistance from the organisation's profile, the idea, the applicant's details and the call data, in the structure of the official template. Check every fact, number and rule against the call documents. Text marked \"(to be confirmed)\" needs your input. The applicant is responsible for the submitted content.",
        tbc: "(to be completed)", tbcShort: "(to be confirmed)", participants: "List of participants", no: "No.", participant: "Participant", country: "Country", orgType: "Type", partner: "partner", coordinator: "coordinator",
        gantt: "Timing of the work packages (Gantt chart)", t31a: "List of work packages", t31b: "Work package description", t31c: "List of deliverables", t31d: "List of milestones", t31e: "Critical risks for implementation", t31f: "Summary of staff effort",
        t31g: "'Subcontracting costs' items", t31h: "'Purchase costs' items (major equipment costs)", t31gNote: "To be completed by the consortium if subcontracting is planned: participant, cost (EUR), description of tasks and justification.", t31hNote: "To be completed for participants whose equipment costs exceed 15% of their personnel costs: participant, cost (EUR), justification.",
        wpNo: "WP No.", wpTitle: "Work package title", leadNo: "Lead No.", leadName: "Lead participant", pm: "Person-months", startM: "Start month", endM: "End month", startEnd: "Start and end", objectives: "Objectives", descWork: "Description of work",
        delName: "Deliverable name", shortDesc: "Short description", type: "Type", dissem: "Dissemination level", month: "Delivery month", msName: "Milestone name", relWp: "Related WP(s)", dueMonth: "Due month", verification: "Means of verification",
        riskDesc: "Description of risk", wpsInvolved: "WP(s) involved", mitigation: "Proposed risk-mitigation measures", likelihood: "likelihood", severity: "severity", lv: { low: "low", medium: "medium", high: "high" }, totalPm: "Total person-months",
        context: "Context", item: "Item", value: "Value", field: "Field", formLang: "Language used to fill in the form", participatingOrgs: "Participating organisations",
        activity: "Activity", venue: "Venue", start: "Start", end: "End", lead: "Leading organisation", amount: "Amount (EUR)", expected: "Expected results", grant: "Grant (EUR)", noActivities: "Number of activities", total: "Total",
        pmAmount: "Grant amount allocated to project management", budgetSummary: "Budget summary", subcontractNote: "Subcontracting of services is allowed if it does not cover core activities; if planned, its amount must be included in the description of the activities.", characters: "characters", footer: "AI-assisted draft, check before submitting" },
      chk: { pagesUnknown: (p) => `Estimated length about ${p} pages; the call's page limit is not in our data.`, basisCriteria: "Structure built from the call's award criteria, not from an official form: check the call's application form.", basisGeneral: "General structure, not an official form: check the call's application form and its questions.",
        unitsDone: (n) => `All ${n} parts are written.`, unitsMissing: (m, n) => `${m} of ${n} parts are not written yet.`, pages: (p, l) => `Estimated length about ${p} pages; the limit is ${l} pages (the official template at its font size decides).`,
        consortium: (n, c) => `${n} organisations from ${c} countries.`, consortiumHE: (n, c) => `${n} organisations from ${c} countries named. Most Horizon Europe topics need at least 3 independent organisations from 3 different EU Member States or Associated Countries; check the topic's conditions.`,
        consortiumEP: (mo, mc, n, c) => `The action needs at least ${mo} organisations from ${mc} different countries (EU Member States or third countries associated to the Programme); ${n} from ${c} countries are named.`,
        dmp: (id, m) => `Data management plan: ${id}, month ${m}.`, dmpMissing: "No data management plan deliverable by month 6 (required for funded proposals).", pmWp: (id) => `Project management work package: ${id}.`, pmWpMissing: "No project management work package (the template advises one).",
        overMax: (a, m) => `The requested amount ${a} EUR is above the call's ${m} EUR per project.`, lumpSum: (a) => `Lump sum: ${a} EUR.`, lumpSumMissing: (l) => `Choose one of the lump sums: ${l.join(", ")} EUR.`,
        duration: (d, a, b) => `Duration ${d} months (allowed ${a} to ${b}).`, durationMissing: (a, b) => `Set the duration (${a} to ${b} months).`, split: (n, a) => `The ${n} amounts add up to the lump sum of ${a} EUR.`, splitOff: (s, a) => `The amounts add up to ${s} EUR, not ${a} EUR.`,
        fieldMissing: "Choose the field (school, VET, adult, youth or higher education).", tbc: (n) => `${n} place(s) marked "to be confirmed" need your input.`, noTbc: "Nothing is marked \"to be confirmed\"." } },
    pwTitle: "Premium access", pwTitleFree: "Free trial", pwLede: "You have used your free idea generation. Premium access unlocks further idea generation, the detailed proposal PDF and the Erasmus+ evaluation.",
    pwFreeLeft: (n) => `You can generate project ideas ${n === 1 ? "once" : n + " times"} for free. The detailed proposal PDF and the Erasmus+ evaluation need premium access.`,
    pwAskEarly: "Ask for premium access now", pwAsk: "Request access", pwAskDone: "Request sent. The administrator has been notified.",
    pwSent: (t) => `Request sent ${t}. Access is activated by the administrator after the payment is confirmed.`,
    pwHowPay: "How to pay", pwNoInstructions: "The administrator will contact you with payment details.",
    pwRef: "Payment reference or note (optional)", pwPaidBtn: "I have paid", pwPaidDone: "Thank you. The administrator will check the payment and activate access.",
    pwPaid: (t) => `Payment reported ${t}. Waiting for the administrator to confirm it.`,
    pwStatus: { rejected: "Your last request was declined", revoked: "Your premium access was revoked", expired: "Your premium access has expired" },
    working: "Working…", loadingPage: "Loading…", op: { uploading: "Uploading", reading: "Reading the document", ocr: "Recognising text (OCR)", analysing: "Analysing with AI", researching: "Reading the website", generating: "Generating with AI", drawing: "Drawing the PDF", saving: "Saving", checking: "Checking against the official text", translating: "Translating to English", completed: "Done", failed: "Failed" },
    trT: "English copy for matching", trLede: "Call texts are in English, so text written in another language is matched through an English copy. The copy below is a machine translation, used only for matching: your original text stays the profile record. You can correct the copy; your edits are kept and never replaced by a new automatic translation.",
    trMachine: (m, t) => `Machine translation${m ? " (" + m + ")" : ""}, ${t}`, trEdited: (t) => `Edited by you, ${t}`, trStaleAuto: "Made from an earlier version of the text, so it is not used for matching until it is translated again.", trStaleEdited: "The original text has changed since you edited this copy. Check that it still matches.",
    trNone: "No English copy yet: matching uses the original text.", trRun: "Translate now", trSave: "Save copy", trSaved: "Copy saved.", trCleared: "Copy removed; the next save makes a machine translation again.", trDone: (n) => `English copy made for ${n} field(s).`, trNothing: "Every field already has an English copy.", trFailed: "The English copy could not be made, so matching uses the original text:",
    trUse: "Used for matching", trOrig: "Original text",
    adminTitle: "Administration", auAgents: "Use by function today", auAgentsNote: "Workers AI neurons count only for the Workers AI share; tokens count for every provider. Each row is the sum of the model requests made for that function.", auFn: "Function", auAg: { extract: "Reading documents", research: "Reading websites", ideas: "Project idea generation", fit: "Fit explanation", proposal: "Detailed proposal", evaluate: "Evaluation against call criteria", official: "Official eligibility check", translate: "Translations", improve: "Revising ideas below the threshold", other: "Other" }, auTitle: "AI usage today", auRefresh: "Refresh", auProvider: "Provider and model", auUsed: "Used", auBudget: "Daily budget", auOfBudget: "Of budget", auReq: "Requests",
    auLede: (d, r, s) => `UTC day ${d}. Allowances reset at ${r} (Belgrade time). The site stops each provider at its budget and moves to the next one; the workspace may use at most ${s}% of each budget, so the public assistant keeps working.`,
    auMsgs: (v, l) => `assistant messages from ${v} visitors (limit ${l} per visitor)`, auActions: (u, l) => `workspace AI actions by ${u} users (limit ${l} per user)`, auRequests: "AI requests in total",
    auNeurons: "neurons", auTokens: "tokens", auFree: (f) => `free tier ${f}`, auCached: (n, t) => `${n} answer${n === 1 ? "" : "s"} came from stored results today (${t} tokens the providers did not have to serve).`, auCacheCol: "From stored results", auOff: "not configured", auUsers: "Workspace AI actions per user", auWeek: "Last 7 days", auDay: "Day (UTC)", admLede: "Premium access requests, users and subscription settings. Changes take effect immediately.",
    admSt: { none: "No request", pending_payment: "Pending payment", payment_submitted: "Payment submitted", active: "Active", rejected: "Rejected", revoked: "Revoked", expired: "Expired" },
    admFilter: "Filter requests", admOpen: "Waiting", admAll: "All, with history", admRequests: "Access requests", admUsers: "Users",
    admWhen: "Requested", admUser: "User", admPlanCol: "Plan", admStatus: "Status", admJoined: "Joined", admRuns: "Idea runs",
    admPaidAt: (t) => `paid ${t}`, admRef: "Reference", admOld: "older request", admGranted: (d) => `granted ${d}`, admEnds: (d) => `ends ${d}`,
    admMailed: "admin e-mail sent", admNotMailed: (e) => `admin e-mail not sent (${e})`, admBy: (e) => `by ${e}`,
    admManage: "Manage", admNote: "Note (shown to the user)", admDays: "Days of access (empty = default)",
    admApprove: "Approve and activate", admMarkPaid: "Mark as paid", admReject: "Reject", admRevoke: "Revoke", admExpire: "Mark expired", admGrant: "Grant access",
    admDone: "Saved.", admSave: "Save settings", admCsv: "Download users (CSV)",
    admSettings: "Subscription settings", admSettingsLede: "Plans and prices are shown to users as written here. No price is built into the code.",
    admFree: "Free idea generations per user", admDaysDefault: "Default days of access (empty = until revoked)",
    admPlan: "Plan", admPlanId: "Code", admPlanName: "Name", admPlanPrice: "Price (as shown)", admPricePh: "e.g. 49 EUR per year", admPlanDesc: "Description", admAddPlan: "+ Add plan",
    admPay: "Payment instructions shown after a request (bank account, reference format)",
    errors: { no_official_text: "There is no official text for an AI check of this call.", no_criteria: "The award criteria of this call are not in our data, so the idea cannot be evaluated here.", too_many_reports: "This organisation has reached 200 saved reports. Delete older ones first.", too_large: "This report is too large to save.", premium_required: "This needs premium access. See Premium access on the Project ideas page.", no_open_request: "There is no open access request. Request access first.", signin: "Please sign in.", role: "Your role does not allow this.", not_found: "Not found, or you do not have access.", email: "Enter a valid e-mail address.", terms: "Please accept the privacy notice.", verification: "The bot check failed. Reload the page and try again.", too_many: "Too many requests for today. Try again tomorrow.", email_unavailable: "Sign-in e-mails cannot be sent right now.", ai_user_limit: "You have used today's AI actions. They reset at midnight UTC.", ai_resting: "The AI allowance for today is used up. It resets at midnight UTC.", ai_busy: "The AI service is busy. Try again in a minute.", ai_unavailable: "The AI service did not answer. Try again later.", ai_bad_answer: "The AI answer could not be read. Try again.", not_below: "This idea is not below the threshold, so it is not revised.", revision_limit: "This idea has already been revised twice. Generate a new idea for the call instead.", url_invalid: "Enter a public web address (https://…).", robots_disallow: "The site's robots.txt does not allow automated reading of this page.", page_unavailable: "The page could not be opened.", pdf_upload_instead: "This address is a PDF: download it and upload it as a document.", unsupported_type: "This address is not a web page.", page_empty: "No readable text on this page.", text_too_short: "Too little text to analyse.", last_owner: "An organisation needs at least one owner.", transfer_ownership: "Make another member owner of your shared organisations first.", version_conflict: "Someone else saved the profile in the meantime.", too_many_orgs: "You have reached the number of organisations per account.", google_off: "Google sign-in is not set up on this site yet.", google_cancelled: "Google sign-in was cancelled.", google_state: "The sign-in took too long or was opened in another tab. Please try again.", google_failed: "Google sign-in failed. Please try again.", google_unverified: "Google has not verified this e-mail address.", email_login_off: "Sign-in by e-mail link is not available.", server_error: "Something went wrong on the server.", csrf: "The request was blocked as cross-site. Reload the page.", db_unavailable: "The database is not connected.", network: "No connection to the server.", ideas_limit: "Your organisation has used today's idea generations. Try again tomorrow.", no_calls: "None of the selected calls is open to your organisation.", profile_incomplete: "Complete the profile first: name, type, country and a description.", data_unavailable: "The call data could not be read. Try again later." },
  },
  sr: {
    title: "Analiza organizacije", lede: "Profil vaše organizacije, proveren u odnosu na sve otvorene pozive na Eligible Calls.",
    signinTitle: "Prijava na analizu organizacije", signinLede: "Napravite profil svoje organizacije, proverite podobnost za otvorene pozive i sačuvajte rezultate. Prijavite se Google nalogom: Eligible Calls od Google-a dobija samo vašu e-mail adresu, nikada lozinku.",
    google: "Prijava preko Google naloga", acceptFirst: "Prvo označite polje o privatnosti.", orEmail: "Ili dobijte link za prijavu e-poštom",
    inviteNote: "Dobiće pristup kada se prijave Google nalogom sa ovom adresom.",
    email: "E-mail adresa", sendLink: "Pošalji link za prijavu", accept: (url) => `Saglasan/saglasna sam da Eligible Calls čuva moju e-mail adresu i profil organizacije radi pružanja ove usluge, kako je opisano u <a href="${url}">obaveštenju o privatnosti</a>.`,
    news: "Povremeno mi šaljite vesti o novim pozivima (nije obavezno; možete se odjaviti u svakom trenutku).",
    linkSent: "Proverite poštu: link važi jednom i ističe za 20 minuta.", devLink: "Lokalni razvoj: e-mail se ne šalje. Koristite ovaj link:",
    continueTitle: "Završite prijavu", continueBtn: "Nastavi", linkInvalid: "Ovaj link više ne važi (već je iskorišćen ili je istekao). Zatražite novi.",
    createTitle: "Napravite organizaciju", createLede: "Počnite od naziva. Profil možete popuniti ručno, iz dokumenata ili sa veb-sajta.", orgName: "Naziv organizacije", create: "Napravi",
    nav: { overview: "Pregled", profile: "Profil organizacije", documents: "Dokumenti i izvori", matching: "Provera podobnosti", ideas: "Projektne ideje", evaluation: "Kriterijumi ocenjivanja", reports: "Sačuvani izveštaji", settings: "Podešavanja" },
    soon: "sledeća faza", newOrg: "+ Nova organizacija", signOut: "Odjava",
    complete: "Popunjenost profila", analysed: "Analiziranih otvorenih poziva", high: "Visoka kompatibilnost (70%+)", eligibleN: "Podobni prema dostupnim podacima",
    missingTitle: "Podaci koji nedostaju", missingNone: "Sva polja važna za proveru su popunjena.", strengthsTitle: "Prednosti uočene u profilu",
    upcoming: "Predstojeći rokovi kompatibilnih poziva", none: "Još nema.", lastUpdate: (d, v) => `Verzija profila ${v}, sačuvana ${d}.`, recentRuns: "Poslednja izdvajanja",
    fillProfile: "Popunite profil", openMatching: "Svi rezultati",
    save: "Sačuvaj profil", saved: (v) => `Sačuvano kao verzija ${v}.`, unsaved: "Nesačuvane izmene", conflict: "Neko drugi je u međuvremenu sačuvao profil. Učitajte ponovo da biste videli njegovu verziju; vaše izmene ostaju u formularu.", reload: "Učitaj ponovo",
    invalid: "Neka polja nisu ispravna; označena su ispod.", viewerNote: "Možete da pregledate ovu organizaciju. Menjati je mogu samo urednici i vlasnici.",
    sections: { identity: "Osnovni podaci", about: "Misija i aktivnosti", experience: "Iskustvo", capacity: "Kapaciteti i resursi", partners: "Partnerstva" },
    prov: { manual: "uneto ručno", document: "iz dokumenta", web: "sa sajta" }, unverified: "automatski popunjeno: proverite", verifiedBy: "odobreno",
    yes: "Da", no: "Ne", unknown: "Nije navedeno",
    docsTitle: "Dokumenti i izvori", docsLede: "Otpremite statut, rešenje o registraciji, godišnji izveštaj ili projektni dokument (i skeniran, na ćirilici ili latinici), ili navedite svoj sajt. Tekst se čita u vašem pregledaču, sa OCR-om za skenirane dokumente, i jednom šalje AI modelu; sama datoteka se ne čuva. Vrednosti sa jasnim dokazom automatski popunjavaju prazna polja profila, svaka označena izvorom. Vrednosti koje se razlikuju od profila prikazuju se da vi odlučite.",
    upload: "Izaberite dokument ili sken", reading: "Čitanje dokumenta…", sending: (i, n) => `Analiza dela ${i} od ${n}…`, jobOpen: "Pregledajte pronađene podatke", jobDocs: "Dokumenti i izvori", jobClose: "Zatvori", jobBusy: "Dokument se još čita. Sačekajte da se završi, pa otpremite sledeći.", aiWait: (i, n, s) => `Deo ${i} od ${n}: dostignuto je ograničenje AI servisa po minutu, novi pokušaj za ${s} s…`, scanned: "Iz ove datoteke nije moguće pročitati tekst. Unesite podatke u profil ili pokušajte sa drugom kopijom dokumenta.",
    tooLong: (n, max) => `Dokument je dugačak: analizira se samo prvih ${max} delova (${n} znakova).`,
    aiLeft: (l, n, t) => `Preostale AI akcije danas: ${l} od ${n} (obnavljaju se u ${t})`, partCached: (i, n) => `Deo ${i} od ${n} je već pročitan: AI akcija nije potrošena.`,
    docNeeds: (n, l) => `Dokument ima ${n} delova i treba mu najviše ${n} AI akcija; danas vam je ostalo ${l}. Delovi koji su već pročitani ne troše akcije.`,
    docCached: (c, n) => `${c} od ${n} delova preuzeto je iz ranijeg čitanja istog teksta (bez AI akcija).`,
    docResume: "Do sada pročitani delovi su sačuvani: otpremite isti dokument ponovo posle obnavljanja i oni neće trošiti AI akcije.",
    webTitle: "Čitanje sa vašeg sajta", webLede: "Čitamo stranicu koju navedete i najviše dve povezane stranice o organizaciji („O nama“, „Misija“, „Projekti“) na istom sajtu, uz poštovanje robots.txt. Predlažu se samo podaci citirani sa tih stranica.", url: "Adresa sajta ili stranice", readSite: "Pročitaj sajt",
    review: "Pregled predloženih polja", reviewLede: "Uz svaku vrednost stoji rečenica iz koje je preuzeta. Vrednosti koje citat ne potvrđuje jasno, ili koje profil već ima, nisu označene; proverite ih sami. Liste se dodaju na ono što profil već ima.",
    field: "Polje", proposed: "Predložena vrednost", current: "Trenutna vrednost", evidence: "Citat iz izvora", conf: "Pouzdanost", found: "Citat pronađen u izvoru", notFound: "Citat NIJE pronađen u izvoru", valueNotInQuote: "Citat je pronađen, ali vrednost u njemu nije napisana", weakQuote: "Citat je pronađen, ali ne navodi jasno ovu vrednost", adds: (v) => `Dodaje: ${v}`, alreadyHas: "Već postoji u profilu", same: "Isto kao u profilu",
    apply: "Primeni označeno na profil", discard: "Odbaci", applied: (n) => `Polja dodata u profil: ${n}.`, runs: "Ranija izdvajanja", status: { review: "za pregled", applied: "primenjeno", discarded: "odbačeno" }, del: "Obriši", open: "Otvori",
    confL: { high: "visoka", medium: "srednja", low: "niska" }, dropped: (n) => `Uklonjeno predloženih vrednosti: ${n} (neispravne ili sa ličnim podacima).`, noQuote: (n) => `Izostavljene vrednosti bez citata iz izvora: ${n}.`,
    matchTitle: "Provera podobnosti", matchLede: (n, d) => `Provereno je ${n} otvorenih i najavljenih poziva u odnosu na profil vaše organizacije, prema podacima o pozivima od ${d}.`,
    mxStatusT: "Obavezna podobnost", mxStatus: "Da li možete da konkurišete? Država, vrsta organizacije, konzorcijum i uslovi pročitani iz zvaničnih dokumenata svakog poziva. Jedan neispunjen uslov čini poziv nepodobnim, bez obzira na procenat; uslov koji nije mogao da se proveri prikazan je kao za proveru.",
    mxScoreT: "Strateška usklađenost", mxScore: "Koliko poziv odgovara vašoj misiji, iskustvu, ciljnim grupama i kapacitetu. Pomaže vam da birate među pozivima za koje možete da konkurišete; nikada ne menja status.",
    legendL: { low: "Niska", medium: "Srednja", high: "Visoka" }, filtersT: "Filteri i redosled", resetF: "Poništi filtere", compatK: "Usklađenost", mreq: (p, v, f) => `${p} ispunjeno · ${v} za proveru · ${f} nije ispunjeno`,
    scoreLegend: "Usklađenost sa vašim radom: crvena 0–49%, žuta 50–69%, zelena 70–100%.", tierL: { high: "70–100%", medium: "50–69%", low: "0–49%" },
    notice: "Oba rezultata dobijena su primenom pravila na vaš profil i podatke o pozivu. Nisu pravna odluka niti verovatnoća finansiranja: uvek su merodavna zvanična dokumenta poziva.",
    fStatus: "Svi statusi", fProg: "Svi programi", fDl: "Bilo koji rok", dl30: "Narednih 30 dana", dl60: "Narednih 60 dana", dl120: "Narednih 120 dana", onlyHigh: "Samo 70%+", sortScore: "Redosled: kompatibilnost", sortDl: "Redosled: rok",
    showing: (n, m) => `${n} od ${m} poziva`, more: "Prikaži još", strengths: "Prednosti", problems: "Mogući problemi", missing: "Nedostajući podaci", next: "Sledeći korak", report: "Detaljna procena", official: "Zvanična stranica",
    deadline: "Rok", funding: "Iznos", notStated: "Uslov nije naveden", missingCall: "Profil sadrži podatke koje ova procena koristi za ovaj poziv.", perGrant: "po grantu", topicBudget: "ukupan budžet teme", programme: "Program", noCountry: "Dodajte državu i vrstu organizacije u profil: bez njih nijedan poziv ne može da se proveri.",
    statusL: { eligible: "Podobna prema dostupnim podacima", potential: "Moguće podobna: potrebna provera", ineligible: "Nije podobna: obavezan uslov nije ispunjen", insufficient: "Nedovoljno podataka" },
    bandL: { high: "Visoka kompatibilnost", medium: "Srednja kompatibilnost", excellent: "Odlična kompatibilnost", strong: "Velika kompatibilnost", moderate: "Umerena kompatibilnost", low: "Niska kompatibilnost", verylow: "Veoma niska kompatibilnost" },
    repA: "Ukupna procena", mandT: "Obavezna podobnost: da li možete da konkurišete?", stratT: "Strateška usklađenost: koliko poziv odgovara?", stratWhat: "Ponderisana usklađenost poziva sa vašom misijom i oblastima rada, iskustvom, ciljnim grupama, kapacitetom i partnerstvima. Država i vrsta organizacije nisu deo nje: one određuju status.", offT: "Zvanična dokumentacija o podobnosti", offLede: "Obavezni uslovi iznad koji su označeni kao zvanični dokument poziva potiču iz ovog izvora. Eligible Calls čita deo o podobnosti iz dokumenta poziva (ili sa stranice finansijera) i čuva citiranu rečenicu za svaki uslov.", offPub: "Izdavač", offDoc: "Dokument", offPublished: "Objavljeno", offVerified: "Poslednja provera", offNone: "Za ovaj poziv se ne čita zvanični dokument o podobnosti.", aiT: "AI provera prema zvaničnom tekstu", aiLede: "AI navodi svaki obavezan uslov iz zvaničnog teksta, citira ga i proverava vaš profil. Zadržavaju se samo uslovi čiji je citat pronađen u zvaničnom tekstu; rezultat koji se ne oslanja na popunjeno polje profila prikazuje se kao za proveru. Rezultati se računaju u status podobnosti. Provera se pokreće sama kada urednik prvi put otvori izveštaj o ovom pozivu; posle izmene profila pokrećete je dugmetom „Proveri ponovo“.", aiRun: "Proveri profil prema zvaničnom tekstu", aiRerun: "Proveri ponovo", aiStale: (v) => `Urađeno na osnovu verzije profila ${v}; profil se od tada promenio. Ponovite proveru da biste ažurirali status.`, aiNoText: "Za ovaj poziv nema zvaničnog teksta za AI proveru.", aiApplies: { applicant: "podnosilac", coordinator: "koordinator", consortium: "konzorcijum", all: "svi učesnici" }, aiMade: (t) => `Provereno ${t}`, aiCounts: "Ovi rezultati se računaju u status iznad.", repB: "Provereni uslovi", repB2: "Kompatibilnost po dimenzijama", repC: "Prednosti organizacije", repD: "Nedostaci u podobnosti", repE: "Podaci koji nedostaju", repF: "Preporuke",
    requirement: "Uslov", result: "Rezultat", basis: "Osnov", weight: "Ponder", part: "Ocena",
    resL: { pass: "Ispunjen", fail: "Nije ispunjen", warn: "Mogući problem", unknown: "Za proveru", missing: "Nedostaju podaci u profilu" },
    srcL: { official: "zvanični dokument poziva", "official-ai": "zvanični dokument, AI provera", "programme-list": "lista zemalja učesnica Evropske komisije", call: "tekst poziva", source: "izvor poziva", derived: "pravila Eligible Calls nad tekstom poziva", "call-rule": "citiran zvanični tekst", none: "izvorni podaci" },
    capNote: "Ocena je ograničena jer poziv ima malo dodirnih tačaka sa vašim oblastima i ciljevima.",
    assessedAt: (d, v, g) => `Procenjeno ${d} na verziji profila ${v} i podacima o pozivima od ${g}. Procena se ponovo računa pri svakoj izmeni profila ili podataka o pozivu.`,
    explain: { eligible: "Nijedan obavezan uslov nije prekršen prema dostupnim podacima i svi provereni uslovi su ispunjeni.", potential: "Nijedan obavezan uslov nije prekršen, ali neke treba proveriti u dokumentu poziva ili dopuniti profil.", ineligible: "Najmanje jedan obavezan uslov nije ispunjen. Ocena kompatibilnosti je samo informativna.", insufficient: "Za proveru podobnosti potrebni su država i vrsta organizacije." },
    dims: { orgType: "Vrsta i pravni status organizacije", country: "Država i geografska podobnost", objectives: "Usklađenost sa ciljevima poziva", experience: "Iskustvo i prethodni projekti", targetGroups: "Ciljne grupe i korisnici", capacity: "Operativni i administrativni kapacitet", partnerships: "Partnerstva i međunarodna saradnja" },
    evalTitle: "Kriterijumi ocenjivanja", evalLede: "Kako se predlozi boduju, prema zvaničnim dokumentima: Opšti aneks D programa Horizont Evropa, dokument svakog poziva, stranica finansijera i Vodič kroz program Erasmus+. Podobnost (smemo li da konkurišemo?) i kvalitet (da li bi ocenjivači dobro ocenili predlog?) su odvojena pitanja: podobna organizacija i dalje može podneti slab predlog.",
    evalTabCalls: "Po pozivu", evalCallsNote: "Vaši otvoreni pozivi, najkompatibilniji prvi. Kriterijumi su navedeni na engleskom, jeziku zvaničnih dokumenata; merodavna su dokumenta samog poziva.", progL: "Program",
    evalShowIneligible: "Prikaži i pozive na koje ne možete da konkurišete", evalCount: (n, k) => `Poziva: ${n}; za ${k} kriterijumi su prikazani ovde, za ostale poziv navodi gde se nalaze.`,
    kindL: { framework: "Opšti aneks D", document: "Dokument poziva", page: "Stranica finansijera", pointer: "Videti poziv" }, openReport: "Detaljan izveštaj",
    critNone: "Nema podataka o kriterijumima ocenjivanja za ovaj poziv.", fromCallPage: "Posebno za ovaj poziv (stranica poziva):",
    critFromAnnex: (row) => `Opšti aneks D programa Horizont Evropa, red „${row}“.`, heAnnex: "Opšti aneks D", critFromDoc: "Odeljak „Award criteria“ dokumenta poziva", callDoc: "Dokument poziva", evalForm: "Obrazac za ocenjivanje",
    critFromPage: (src) => `Stranica poziva (${src}), odeljak „How we will assess your application“.`, critPointer: "Kriterijumi nisu objavljeni u obliku koji ovaj sajt može da pročita. Nalaze se u dokumentima samog poziva.", critPointerNote: "Stranica poziva navodi gde su kriterijumi:",
    criterion: "Kriterijum", minPass: "Minimum", maxScore: "Maksimum", fullText: "Ceo tekst kriterijuma",
    scoreOf5: "ocena 0–5", iaWeight: "Uticaj se množi sa 1,5 za rangiranje (inovacione akcije)", heThresholds: "Svaki kriterijum 0–5 · prag 3 · ukupni prag 10 od 15", twoStageChip: "Poziv u dve faze",
    stage1Short: "1. faza", stage1Mark: "Ocenjuje se i u prvoj fazi poziva u dve faze (podebljano u aneksu)", stage1Note: "U prvoj fazi poziva u dve faze boduju se samo Izvrsnost i Uticaj, i to aspekti označeni sa „1. faza“, uz prag 4 za svaki.",
    heScoringTitle: "Ocene i pragovi", heTwoStageTitle: "Pozivi u dve faze", openCallsUsing: (n) => `Otvorenih poziva na Eligible Calls koji se ovako ocenjuju: ${n}.`,
    heOwn: "Akcije Marije Sklodovske-Kiri, Evropski istraživački savet, Evropski savet za inovacije, nagrade i neki pozivi partnerstava imaju sopstvene kriterijume; njihovi pozivi upućuju na njih u delu „Po pozivu“.",
    retrieved: (d) => `preuzeto ${d}`, repEval: "Kako se ovaj poziv ocenjuje", critNotice: "Pomoć za preliminarnu samoprocenu. Merodavni su program rada i dokumenta samog poziva.",
    guide: (y, v) => `Vodič kroz program ${y}, ${String(v).replace(/^Version (\d+) of /, "verzija $1 od ")}`, guideNotice: "Pomoć za preliminarnu samoprocenu. Ocenjivači boduju prema zvaničnom vodiču za godinu poziva; vodič je merodavan.", maxPts: (m, n) => `najviše ${m} bodova · najmanje ${n}`, totalMin: (n) => `Predlog mora imati najmanje ${n} bodova ukupno i najmanje polovinu maksimuma po svakom kriterijumu.`,
    rounds: "Rokovi u ovom vodiču (nacionalne agencije)", optional: "ako ga nacionalna agencija organizuje", where: "Prijava se podnosi Erasmus+ nacionalnoj agenciji vaše zemlje.", na: "Nacionalne agencije",
    ideasTitle: "Projektne ideje", ideasLede: "Koncepti projekata koje vaša organizacija može da razvije, svaki vezan za otvoren poziv sa Eligible Calls. Piše ih AI model na osnovu sačuvanog profila i poziva koje izaberete; pozivi, rokovi, podobnost i ocene kompatibilnosti potiču iz podataka i pravila platforme.",
    ideasAi: "Predlog koji je napisao AI: proverite ga u dokumentaciji poziva pre nego što se na njega oslonite.", ideasPick: "Pozivi za ideje", ideasPickNote: (n) => `Vaši najkompatibilniji otvoreni pozivi: podobni ili za proveru, sa ocenom od najmanje 50%. U jednom pokretanju može se koristiti najviše ${n}.`,
    ideasNoCalls: "Nijedan otvoren poziv još nema 50% kompatibilnosti sa profilom. Dopunite profil ili pogledajte stranicu provere podobnosti.", ideasNeed: "Za ideje profil mora imati naziv, vrstu organizacije, državu i opis, misiju ili ciljeve.",
    ideasGenerate: "Napravi ideje", ideasRegenerate: "Napravi nove ideje", ideasBusy: "Pišem po jednu ideju za svaki izabrani poziv… oko 20 sekundi po pozivu.", ideasUse: "Svaki izabrani poziv troši 1 od vaših dnevnih AI akcija. Novo generisanje zamenjuje ranije predloge koje niste sačuvali; sačuvane ideje ostaju.",
    ideasDone: (n, k) => `Napravljeno ideja: ${n} (izabranih poziva: ${k}).`, ideasZero: "Za izabrane pozive nije bilo moguće napraviti nijednu ideju.",
    ideasMissing: "Nema ideje za:", ideasRetry: "Da biste ponovo probali ove pozive, prvo sačuvajte ideje koje želite da zadržite: novo pokretanje zamenjuje nesačuvane predloge.",
    ideaWhy: { closed: "poziv je zatvoren", not_eligible: "organizacije iz vaše države ne mogu da konkurišu", unknown_call: "poziv više nije objavljen", too_many: "izabrano je više od 6 poziva", no_fit: "AI je utvrdio da organizacija ne može da učestvuje u ovom pozivu", incomplete: "odgovor AI modela je bio nepotpun", ai_bad_answer: "odgovor AI modela nije mogao da se pročita", ai_user_limit: "iskoristili ste današnje AI akcije", ai_resting: "današnja AI kvota je potrošena", ai_busy: "AI servis je bio zauzet", ai_unavailable: "AI servis nije odgovorio" },
    ideasNone: "Još nema ideja.", ideasSaved: "Sačuvane ideje", ideasSuggested: "Najnoviji predlozi", ideasViewerNote: "Možete da čitate ideje. Urednici i vlasnici ih prave, čuvaju i dopisuju beleške.",
    ideaSavedChip: "Sačuvano", ideaSave: "Sačuvaj", ideaUnsave: "Ukloni iz sačuvanih", ideaNotes: "Beleške", ideaNotesSave: "Sačuvaj beleške", ideaNotesSaved: "Beleške su sačuvane.", ideaCompare: "Uporedi", ideaDelete: "Obriši",
    ideaF: { concept: "Koncept projekta", problem: "Problem koji se rešava", solution: "Predloženo rešenje", objectives: "Glavni ciljevi", targetGroups: "Ciljne grupe", activities: "Predložene aktivnosti", expectedResults: "Očekivani rezultati i uticaj", potentialPartners: "Mogući partneri", whyItFits: "Zašto ovaj projekat ima smisla", methodology: "Metodologija", workPlan: "Plan rada", impactPathway: "Put do uticaja", dissemination: "Diseminacija, eksploatacija i komunikacija", management: "Upravljanje, resursi i rizici" },
    fitExplainT: "Zašto ova procena", fitStrengths: "Šta se uklapa", fitWeak: "Šta je slabo ili nedostaje", fitImprove: "Kako povećati uklapanje", fitExplainRun: "Objasni ovu procenu", ideaCall: "Odgovarajući poziv", compatRule: "Kompatibilnost organizacije i poziva (pravila)", conceptFitL: "Uklapanje koncepta (AI procena)", fitTitle: "AI ocene (1–5)",
    fitL: { alignment: "Usklađenost sa pozivom", priorities: "Prioriteti programa", feasibility: "Izvodljivost", impact: "Mogući uticaj" },
    ideaStale: (v) => `Napravljeno na osnovu verzije profila ${v}; profil je od tada izmenjen.`, ideaClosed: "Ovaj poziv više nije otvoren.", ideaGen: (d, sc) => `Napravljeno ${d}; kompatibilnost tada ${sc}%.`,
    compareTitle: "Poređenje", compareHint: "Označite „Uporedi“ na dve ili tri ideje da ih vidite jednu pored druge.", compareMax: "Možete uporediti najviše tri ideje.", savedIdeasN: "Sačuvane projektne ideje",
    reportsTitle: "Sačuvani izveštaji", reportsSoon: "Čuvanje i izvoz izveštaja dolazi uz asistenta za ocenjivanje (sledeća faza). Procene se računaju uživo na stranici provere podobnosti.",
    settingsTitle: "Podešavanja", members: "Članovi", invite: "Dodajte člana preko e-mail adrese", role: "Uloga", roles: { owner: "Vlasnik", editor: "Urednik", viewer: "Posmatrač" }, add: "Dodaj",
    invited: "Pozvan (još nije registrovan)", remove: "Ukloni", leave: "Napusti ovu organizaciju", versions: "Istorija profila", changedF: "Izmenjena polja", by: "",
    account: "Vaš nalog", newsToggle: "E-mail vesti", deleteAccount: "Obriši moj nalog", deleteAccountNote: "Briše vaš nalog, sesije prijave i organizacije u kojima ste jedini član.", deleteAccountConfirm: "Da, trajno obriši moj nalog", cancel: "Otkaži", signedInAs: (e) => `Prijavljeni ste kao ${e}`,
    deleteOrg: "Obriši ovu organizaciju", deleteOrgNote: (n) => `Briše profil, njegovu istoriju i sve rezultate izdvajanja. Upišite naziv organizacije (${n}) da potvrdite.`, confirmDel: "Trajno obriši",
    savedReportsN: "Sačuvani izveštaji", goReports: "Otvori sačuvane izveštaje",
    repSaveTitle: "Sačuvajte ovaj izveštaj", repSaveLede: "Čuva ovu procenu kakva je sada, sa verzijom profila i datumom podataka o pozivu, da biste joj se vratili, kasnije je uporedili i preuzeli kao PDF.",
    repNote: "Napomena", repNotePh: "npr. razgovarano sa upravom, prijava u martu", repSave: "Sačuvaj izveštaj", repSaved: "Izveštaj je sačuvan.", repOpenSaved: "Otvori u Sačuvanim izveštajima",
    reportsLede: "Izveštaji o podobnosti sačuvani sa stranice provere. Svaki čuva procenu kakva je bila pri čuvanju; kolona Sada prikazuje današnju ocenu za isti poziv i profil.",
    reportsEmpty: "Još nema sačuvanih izveštaja. Otvorite poziv u odeljku „Provera podobnosti“ i kliknite na „Sačuvaj izveštaj“.", reportsSearch: "Pretraga po nazivu poziva i napomenama",
    repCsv: "Preuzmi spisak (CSV)", repColSaved: "Sačuvano", repColCall: "Poziv", repColScore: "Ocena tada", repColStatus: "Status tada", repColNow: "Sada",
    repCallGone: "Poziv više nije u objavljenim podacima.", repSavedAt: (t) => `Sačuvano ${t}`, repProfileV: (v) => `verzija profila ${v}`, repProfileNow: (v) => `(sada ${v})`, repDataDate: (d) => `podaci o pozivu od ${d}`,
    repNoteSave: "Sačuvaj napomenu", repNoteSaved: "Napomena je sačuvana.", repPdf: "Preuzmi izveštaj (PDF)", repDelete: "Obriši izveštaj", repDeleteConfirm: "Kliknite ponovo za brisanje",
    repChange: "Od čuvanja izveštaja", repThen: "Sačuvano", repNow: "Sada", repNewCheck: "nova provera", repSameResult: "Svi uslovi imaju isti rezultat kao pri čuvanju izveštaja.",
    repOpenCurrent: "Otvori trenutni izveštaj", repSavedVersion: "Sačuvani izveštaj", repPdfFooter: "preliminarna samoprocena, dokumentacija poziva ima prednost",
    goComplete: "Popunite prazna polja", goProfile: "Uredite profil", goList: "Prikaži pozive", goIdeas: "Otvori sačuvane ideje",
    missingHere: (n) => `Praznih polja: ${n}. Označena su ispod.`, orFromDocs: "Ili ih popunite iz dokumenta",
    ocrLoading: "Učitava se prepoznavanje teksta (OCR) za srpsku ćirilicu, latinicu i engleski. Prvi put traje malo duže.",
    readingPage: (i, n) => `Čita se strana ${i} od ${n}…`, ocrPage: (i, n) => `Prepoznaje se tekst na strani ${i} od ${n} (OCR)…`,
    ocrDone: (n) => `OCR je prepoznao tekst na stranama: ${n}.`, ocrLow: (n) => `Teško čitljivih strana: ${n}. Proverite popunjene vrednosti.`,
    ocrEmpty: "OCR u ovoj datoteci nije pronašao skoro nikakav tekst. Pokušajte sa oštrijim skeniranjem (najmanje 300 dpi) ili unesite podatke u profil.",
    ocrUnavailable: "Prepoznavanje teksta nije moglo da se učita. Proverite vezu i pokušajte ponovo.", badType: "Ova vrsta datoteke nije podržana.",
    uploadFormats: "PDF (tekstualni ili skeniran), JPG, PNG, TIFF, DOCX ili TXT. Čitaju se i ćirilica i latinica.",
    readingSite: "Čita se sajt…", filling: "Popunjava se profil…",
    notFilledYet: "Podaci iz ovog izvora još nisu uneti u profil.", fillNow: "Popuni profil",
    filledFrom: (s) => `Popunjeno iz: ${s}`, filledN: (n) => `Popunjenih polja: ${n}.`,
    conflictsN: (n) => `Vrednosti različitih od profila: ${n} (nisu menjane).`,
    notAppliedN: (n) => `Nesigurnih vrednosti koje nisu korišćene: ${n}.`,
    filledValue: "Vrednost sada u profilu", addedToList: "dodato na listu", replaced: (v) => `ranije: ${v}`,
    conflictsTitle: "Razlikuje se od profila", conflictsLede: "Profil već ima drugu vrednost. Ništa nije prepisano; izaberite koju zadržavate.",
    foundValue: "Pronađeno u izvoru", useFound: "Koristi pronađeno", keepCurrent: "Zadrži postojeće",
    notAppliedTitle: (n) => `Nesigurne vrednosti koje nisu korišćene (${n})`, useAnyway: "Ipak koristi",
    why: { low_confidence: "Model nije bio siguran.", quote_not_found: "Navedeni citat nije pronađen u izvoru.", value_not_in_evidence: "Vrednost se ne pojavljuje u citatu.", weak_evidence: "Citat slabo potkrepljuje vrednost." },
    reviewProfile: "Proverite profil", autoNote: "Popunjena polja su označena izvorom i mogu se menjati.",
    runSummary: (f, c) => `popunjeno ${f} · za odluku ${c}`,
    evTitle: "Ocena prema kriterijumima poziva (okvirna)", evLede: "Ideja se ocenjuje prema kriterijumima za dodelu poziva na koji se odnosi, onako kako su objavljeni u dokumentaciji tog poziva (Aneks D programa Horizont Evropa, dokument poziva, stranica finansijera o oceni ili Vodič kroz program Erasmus+). Ocena uz pomoć AI je samo okvirna; zvaničnu ocenu daju eksperti finansijera.",
    evWill: "Kriterijumi:", evCritList: (l) => `ocenjuje se ${l}`, evShown: "Prikazana ocena", evRerun: "Oceni ponovo", evShortDoc: "Kriterijumi poziva", evShortText: "Kriterijumi finansijera",
    evNoCriteria: "Kriterijumi za dodelu ovog poziva nisu u našim podacima (finansijer ih objavljuje samo u dokumentima koje ne možemo da pročitamo), pa ideja ovde ne može da se oceni. Pogledajte dokumenta poziva:",
    evTextScale: "finansijer ne navodi skalu bodova: svaki kriterijum se okvirno ocenjuje od 0 do 5", evNoThreshold: "Prag nije naveden", evNoTotal: "dokumentacija ne navodi ukupni prag", evBasis: "Osnova", evSourceDoc: "Dokumentacija poziva",
    evRun: "Oceni", evBusy: "Ocenjivanje prema kriterijumima poziva…", evDone: "Ocena je sačuvana.",
    evPass: "Iznad pragova", evFail: "Ispod praga",
    evStrengths: "Snage", evWeak: "Slabosti", evMissing: "Elementi koji nedostaju", evRec: "Preporuke",
    evNoMin: (names) => `Nema pojedinačnog minimuma za: ${names}. Dokument poziva ga ne navodi („n/a“), pa se ovi kriterijumi računaju samo u ukupni prag.`,
    evAuto: (i, n) => `ideja ${i} od ${n}`, evAutoDone: (n, f) => `Automatski ocenjeno: ${n} ideja, ispod praga: ${f}.`, evAutoRevised: (n, ok) => `Ideje ispod praga dorađene na osnovu ocene: ${n}; sada prolazi: ${ok}.`, improveRun: "Doradi ideju na osnovu ove ocene", improveBusy: "Ideja se dorađuje na osnovu ocene…", revised: (n, t, m) => `Dorađena verzija ${n}, napisana na osnovu ocene prethodne verzije (${t} / ${m}).`, trNeeded: "Deo ove ideje ili njene ocene nije napisan na standardnom srpskom jeziku.", trRun: "Prikaži na srpskom", trBusy: "Prevodi se…", evNoteQuoted: "Iz dokumenta poziva (citat na engleskom):", evAutoStop: "Automatsko ocenjivanje je zaustavljeno:", evAutoMore: (n) => `Preostale ideje (${n}) možete oceniti dugmetom „Oceni“ na njihovim karticama.`, evSame: "Od poslednje ocene ništa se nije promenilo, pa je prikazan sačuvani rezultat.",
    evAutoPremium: "Ideje se automatski ocenjuju uz premijum pristup; bez njega ocena ostaje prazna.", evAutoNone: "Kriterijumi za dodelu izabranih poziva nisu u našim podacima, pa nijedna ideja nije mogla automatski da se oceni.",
    ideasBelow: "Ispod praga ocenjivanja", ideaBelowChip: "Ispod praga ocenjivanja", pickBelow: "vaša poslednja ideja za ovaj poziv bila je ispod praga ocenjivanja",
    ideasBelowNote: "Okvirna ocena je ove koncepte bodovala ispod praga njihovog poziva, pa ih u ovom obliku ne preporučujemo. Ostaju ovde da biste ih doradili i ponovo ocenili; sam poziv i dalje može da odgovara vašoj organizaciji uz drugačiji koncept.",
    conceptFitBasis: "AI procena napravljena kada je ideja napisana, na osnovu sačuvanog profila i opisa poziva (naziv, program, podobnost, finansiranje i deo teksta poziva). Ocenjuje ovaj koncept, a ne organizaciju; PDF predloga se ne koristi.",
    evalTabsNote: "Horizont Evropa (Opšti aneks D) i Erasmus+ KA210 i KA220 (Vodič kroz program) ocenjuju svaki poziv istim kriterijumima, pa svaki ima svoju karticu. Ostali programi navode kriterijume u dokumentu svakog poziva; izaberite ih pod „Po pozivu“ pomoću filtera programa.",
    evThreshold: (t, m) => `prag za finansiranje ${t} od ${m} bodova`,
    evGuide: (y, v) => `Vodič kroz program ${y}${v ? ", " + v : ""}`, evUsedProposal: "korišćen detaljan predlog",
    evScore: "Bodovi", evTotal: "Ukupno", evPriority: "Šta prvo poboljšati",
    evDisclaimer: "Okvirna ocena uz pomoć AI. Nije zvanična ocena i ne predviđa odluku finansijera.",
    evMade: (t) => `Ocenjeno ${t}`,
    premiumTag: "Premium", premiumNeeded: "Detaljan PDF i ocena su premium funkcije.", premiumHow: "Kako dobiti pristup",
    premiumUntil: (t) => `Premium pristup važi do ${t}.`,
    ideaMore: "Problem, glavni ciljevi, aktivnosti i očekivani rezultati", ideaMoreHint: "Otvorite za celu ideju: rešenje, ciljne grupe, mogući partneri i zašto odgovara pozivu.",
    pdfCreate: "Napravi detaljan predlog (PDF)", pdfDownload: "Preuzmi predlog (PDF)", pdfRegenerate: "Napiši predlog ponovo",
    pdfBusy: "Piše se detaljan predlog. To traje do jednog minuta…", pdfDrawing: "Priprema se PDF…", pdfDone: "PDF je preuzet.", pdfFail: "PDF nije mogao da se napravi. Pokušajte ponovo.",
    pdf: { applicant: "Podnosilac", call: "Poziv", deadline: "Rok", duration: "Trajanje", months: "meseci", made: "Pripremljeno",
      disclaimer: "Nacrt pripremljen uz pomoć AI na osnovu profila organizacije i podataka o pozivu. Proverite svaku činjenicu, broj i pravilo u dokumentaciji poziva pre upotrebe u prijavi. Tekst označen sa „(potrebno potvrditi)“ zahteva vaš unos.",
      tbc: "(potrebno potvrditi)", concept: "Koncept projekta", problem: "Problem i analiza potreba", mainObjectives: "Glavni ciljevi", specificObjectives: "Specifični ciljevi",
      targetGroups: "Ciljne grupe i korisnici", group: "Grupa", description: "Opis", reach: "Obuhvat",
      workPackages: "Aktivnosti i radni paketi", period: "Period", lead: "Nosilac", activities: "Aktivnosti", deliverables: "Isporuke",
      methodology: "Metodologija", outputs: "Očekivani rezultati", output: "Rezultat", indicator: "Indikator", target: "Cilj", impact: "Uticaj",
      partnership: "Partnerstvo", partnerProfile: "Profil partnera", country: "Država", role: "Uloga",
      timeline: "Vremenski plan", phase: "Faza", milestones: "Ključne tačke", monitoring: "Praćenje i evaluacija", sustainability: "Održivost",
      risks: "Rizici i mere", risk: "Rizik", likelihood: "Verovatnoća", mitigation: "Mera", lk: { low: "niska", medium: "srednja", high: "visoka" },
      alignment: "Usklađenost sa pozivom i prioritetima programa", budget: "Okvirna struktura budžeta", requested: "Traženi iznos", callMax: "maksimum poziva",
      noTotal: "Poziv ne navodi iznos po projektu; struktura ispod je u udelima ukupnog iznosa.", category: "Kategorija", share: "Udeo", indicative: "Okvirni iznos", noteCol: "Napomena",
      footer: "nacrt uz pomoć AI, proverite pre upotrebe" },
    app: {
      title: "Cela prijava", follows: "Prati zvaničnu strukturu",
      basisCriteria: "Zvanični obrazac prijave za ovaj poziv nije u našim podacima, pa struktura prati kriterijume za dodelu iz poziva. Proverite obrazac samog poziva i prenesite tekst u njega.",
      basisGeneral: "Zvanični obrazac prijave i kriterijumi za ovaj poziv nisu u našim podacima, pa tekst prati opštu strukturu projekta. Proverite obrazac samog poziva i prenesite tekst u njega.", premium: "Pisanje cele prijave je premium funkcija.",
      lede: "Piše celu prijavu redom kojim ide zvanični obrazac, deo po deo, na osnovu vašeg profila, ove ideje i podataka ispod. Tabele, meseci i iznosi nastaju iz jednog plana, pa se svuda slažu. Vi pregledate tekst, popunite označena mesta i sami podnosite prijavu na zvaničnom portalu.",
      start: "Napiši celu prijavu", open: "Otvori prijavu", hide: "Zatvori prijavu", cont: "Nastavi pisanje", again: "Napiši ponovo sa novim podacima",
      againWarn: "Ponovno pisanje zamenjuje sadašnji tekst, uključujući vaše izmene. Nastaviti?", partsWritten: (n) => `Broj do sada napisanih delova: ${n}.`,
      pdf: "Preuzmi PDF", docx: "Preuzmi Word (.docx)", earlier: "Preuzmi raniji kratak predlog (PDF)",
      fTitle: "Podaci za prijavu", fNote: "Ono što ovde unesete koristi se kao činjenica. Ono što nedostaje upisuje se kao „(potrebno potvrditi)“, da biste kasnije dopunili. Ništa se ne izmišlja o vašoj organizaciji ni o partnerima.",
      fLang: "Jezik prijave", fLangHe: "Predlozi za Horizont Evropa se po pravilu pišu na engleskom.", fLangEp: "Erasmus+ obrazac traži i rezime projekta na engleskom; i on se piše.",
      fDur: "Trajanje (meseci)", fAmount: "Traženi doprinos EU (EUR)", fAmountMax: (m) => `Poziv navodi najviše ${m} EUR po projektu.`, fLump: "Paušalni iznos (EUR)", fLumpPick: "Izaberite…",
      fLumpTopic: "Ova tema se finansira paušalnim iznosom (ograničenje broja strana je veće)", fField: "Oblast", fRole: "Naša uloga", fCoord: "Koordinator", fPartner: "Partner",
      fTrl: "Nivo tehnološke spremnosti (TRL, nije obavezno)", fTrlStart: "na početku", fTrlEnd: "na kraju",
      fPartners: "Partneri, jedan po redu", fPartnersPh: "Naziv | Država | Vrsta | Stručnost i uloga u projektu", fPartnersHint: (n) => `Najmanji broj organizacija, uključujući vašu: ${n}, i to iz isto toliko različitih država. Partneri koji nedostaju prikazuju se kao mesta za popunjavanje.`,
      fTeam: "Tim i ključno osoblje (uloge, stručnost; bez ličnih podataka koje ne želite u tekstu)", fTrack: "Prethodni projekti i rezultati vaše organizacije i partnera", fExtra: "Druge činjenice koje tekst mora da koristi (pilot-projekti, podaci, infrastruktura, pisma podrške, veza sa javnim politikama)",
      fGo: "Napiši prijavu", fCancel: "Otkaži", fields: { school: "Školsko obrazovanje", vet: "Stručno obrazovanje i obuka", adult: "Obrazovanje odraslih", youth: "Mladi", higher: "Visoko obrazovanje" },
      planning: "Planiraju se ciljevi, radni paketi, isporuke i iznosi…", writing: (i, n, t) => `Deo ${i} od ${n}: ${t}`, busyWait: (s) => `AI je zauzet (besplatni nivo, ograničenje po minutu). Novi pokušaj za ${s} s…`,
      done: "Svi delovi su napisani. Pregledajte ih ispod, popunite označena mesta, pa preuzmite.", stopped: "Pisanje je prekinuto. Napisani delovi su sačuvani; pritisnite Nastavi pisanje da biste završili.",
      checks: "Provere koje radi platforma", unitMissing: "još nije napisano", edited: "izmenili ste", chars: (n) => `znakova: ${n.toLocaleString("sr-Latn-RS")}`,
      edit: "Izmeni", save: "Sačuvaj", cancel: "Otkaži", rewrite: "Napiši ovaj deo ponovo", copy: "Kopiraj", copied: "Kopirano.", saved: "Sačuvano.", rewriteWarn: "Ponovno pisanje ovog dela zamenjuje njegov tekst, uključujući vaše izmene. Nastaviti?",
      formLimits: "Onlajn obrazac prikazuje ograničenje broja znakova za svako polje; uporedite ga sa dužinom prikazanom ovde.",
      declaration: "Erasmus+ obrazac traži od podnosioca da potvrdi da prijava sadrži originalan sadržaj čiji je autor organizacija podnosilac. Ovaj tekst koristite kao nacrt: preradite ga svojim rečima i proverite svaku tvrdnju.",
      heNote: "Deo A (učesnici, tabela budžeta, etika i bezbednost) popunjava se direktno na portalu Funding & Tenders; ovaj dokument je Deo B.",
      doc: { acronym: "Akronim", call: "Poziv", template: "Obrazac", duration: "Trajanje", months: "meseci", requested: "Traženi doprinos EU", lumpSum: "Paušalni iznos",
        disclaimer: "Nacrt pripremljen uz pomoć AI na osnovu profila organizacije, ideje, podataka podnosioca i podataka o pozivu, u strukturi zvaničnog obrasca. Proverite svaku činjenicu, broj i pravilo u dokumentaciji poziva. Tekst označen sa „(potrebno potvrditi)“ zahteva vaš unos. Za podneti sadržaj odgovara podnosilac.",
        tbc: "(potrebno dopuniti)", tbcShort: "(potrebno potvrditi)", participants: "Spisak učesnika", no: "Br.", participant: "Učesnik", country: "Država", orgType: "Vrsta", partner: "partner", coordinator: "koordinator",
        gantt: "Vremenski raspored radnih paketa (Gantov dijagram)", t31a: "Spisak radnih paketa", t31b: "Opis radnog paketa", t31c: "Spisak isporuka", t31d: "Spisak ključnih tačaka", t31e: "Kritični rizici za realizaciju", t31f: "Pregled angažovanja osoblja",
        t31g: "Stavke „troškova podugovaranja“", t31h: "Stavke „troškova nabavke“ (veća oprema)", t31gNote: "Konzorcijum popunjava ako planira podugovaranje: učesnik, trošak (EUR), opis zadataka i obrazloženje.", t31hNote: "Popunjava se za učesnike čiji troškovi opreme prelaze 15% troškova osoblja: učesnik, trošak (EUR), obrazloženje.",
        wpNo: "Br. RP", wpTitle: "Naziv radnog paketa", leadNo: "Br. nosioca", leadName: "Nosilac", pm: "Osoba-meseci", startM: "Početni mesec", endM: "Završni mesec", startEnd: "Početak i kraj", objectives: "Ciljevi", descWork: "Opis rada",
        delName: "Naziv isporuke", shortDesc: "Kratak opis", type: "Vrsta", dissem: "Nivo dostupnosti", month: "Mesec isporuke", msName: "Naziv ključne tačke", relWp: "Povezani RP", dueMonth: "Rok (mesec)", verification: "Način provere",
        riskDesc: "Opis rizika", wpsInvolved: "Povezani RP", mitigation: "Predložene mere za ublažavanje rizika", likelihood: "verovatnoća", severity: "ozbiljnost", lv: { low: "niska", medium: "srednja", high: "visoka" }, totalPm: "Ukupno osoba-meseci",
        context: "Kontekst", item: "Stavka", value: "Vrednost", field: "Oblast", formLang: "Jezik na kom se popunjava obrazac", participatingOrgs: "Organizacije učesnice",
        activity: "Aktivnost", venue: "Mesto", start: "Početak", end: "Kraj", lead: "Organizacija nosilac", amount: "Iznos (EUR)", expected: "Očekivani rezultati", grant: "Grant (EUR)", noActivities: "Broj aktivnosti", total: "Ukupno",
        pmAmount: "Iznos granta za upravljanje projektom", budgetSummary: "Pregled budžeta", subcontractNote: "Podugovaranje usluga je dozvoljeno ako ne obuhvata ključne aktivnosti; ako je planirano, iznos mora biti uključen u opis aktivnosti.", characters: "znakova", footer: "Nacrt urađen uz pomoć AI, proverite pre podnošenja" },
      chk: { pagesUnknown: (p) => `Procenjena dužina je oko ${p} str.; ograničenje broja strana za ovaj poziv nije u našim podacima.`, basisCriteria: "Struktura je napravljena iz kriterijuma za dodelu, a ne iz zvaničnog obrasca: proverite obrazac prijave za poziv.", basisGeneral: "Opšta struktura, a ne zvanični obrazac: proverite obrazac prijave za poziv i njegova pitanja.",
        unitsDone: (n) => `Napisani su svi delovi (${n}).`, unitsMissing: (m, n) => `Nenapisani delovi: ${m} od ${n}.`, pages: (p, l) => `Procenjena dužina je oko ${p} str.; ograničenje je ${l} str. (merodavan je zvanični obrazac sa propisanim fontom).`,
        consortium: (n, c) => `Organizacija: ${n}; različitih država: ${c}.`, consortiumHE: (n, c) => `Navedeno organizacija: ${n}; različitih država: ${c}. Većina tema Horizonta Evropa traži najmanje 3 nezavisne organizacije iz 3 različite države članice EU ili pridružene države; proverite uslove teme.`,
        consortiumEP: (mo, mc, n, c) => `Akcija traži najmanje ${mo} organizacije iz ${mc} različite države (države članice EU ili treće zemlje pridružene Programu). Navedeno organizacija: ${n}; različitih država: ${c}.`,
        dmp: (id, m) => `Plan upravljanja podacima: ${id}, mesec ${m}.`, dmpMissing: "Nema isporuke plana upravljanja podacima do 6. meseca (obavezan za finansirane predloge).", pmWp: (id) => `Radni paket za upravljanje projektom: ${id}.`, pmWpMissing: "Nema radnog paketa za upravljanje projektom (obrazac ga preporučuje).",
        overMax: (a, m) => `Traženi iznos ${a} EUR je veći od ${m} EUR po projektu koliko navodi poziv.`, lumpSum: (a) => `Paušalni iznos: ${a} EUR.`, lumpSumMissing: (l) => `Izaberite jedan od paušalnih iznosa: ${l.join(", ")} EUR.`,
        duration: (d, a, b) => `Trajanje u mesecima: ${d} (dozvoljeno od ${a} do ${b}).`, durationMissing: (a, b) => `Unesite trajanje (od ${a} do ${b} meseci).`, split: (n, a) => `Zbir iznosa (stavki: ${n}) jednak je paušalnom iznosu od ${a} EUR.`, splitOff: (s, a) => `Zbir iznosa je ${s} EUR, a ne ${a} EUR.`,
        fieldMissing: "Izaberite oblast (školsko, stručno obrazovanje, obrazovanje odraslih, mladi ili visoko obrazovanje).", tbc: (n) => `Mesta označena sa „potrebno potvrditi“ koja traže vaš unos: ${n}.`, noTbc: "Ništa nije označeno sa „potrebno potvrditi“." } },
    pwTitle: "Premium pristup", pwTitleFree: "Besplatna proba", pwLede: "Iskoristili ste besplatno generisanje ideja. Premium pristup omogućava dalje generisanje ideja, detaljan predlog u PDF-u i Erasmus+ ocenu.",
    pwFreeLeft: (n) => `Projektne ideje možete besplatno generisati ${n === 1 ? "jednom" : n + " puta"}. Detaljan predlog u PDF-u i Erasmus+ ocena zahtevaju premium pristup.`,
    pwAskEarly: "Zatražite premium pristup sada", pwAsk: "Zatraži pristup", pwAskDone: "Zahtev je poslat. Administrator je obavešten.",
    pwSent: (t) => `Zahtev poslat ${t}. Administrator aktivira pristup kada potvrdi uplatu.`,
    pwHowPay: "Kako platiti", pwNoInstructions: "Administrator će vam se javiti sa podacima za uplatu.",
    pwRef: "Poziv na broj ili napomena (nije obavezno)", pwPaidBtn: "Uplatio/la sam", pwPaidDone: "Hvala. Administrator će proveriti uplatu i aktivirati pristup.",
    pwPaid: (t) => `Uplata prijavljena ${t}. Čeka se potvrda administratora.`,
    pwStatus: { rejected: "Vaš poslednji zahtev je odbijen", revoked: "Vaš premium pristup je opozvan", expired: "Vaš premium pristup je istekao" },
    working: "Radi se…", loadingPage: "Učitavanje…", op: { uploading: "Otpremanje", reading: "Čitanje dokumenta", ocr: "Prepoznavanje teksta (OCR)", analysing: "AI analiza", researching: "Čitanje sajta", generating: "AI izrada", drawing: "Izrada PDF-a", saving: "Čuvanje", checking: "Provera prema zvaničnom tekstu", translating: "Prevođenje na engleski", completed: "Gotovo", failed: "Neuspešno" },
    trT: "Engleska verzija za poređenje", trLede: "Tekstovi poziva su na engleskom, pa se tekst napisan na drugom jeziku poredi preko engleske verzije. Verzija ispod je mašinski prevod koji služi samo za poređenje: vaš originalni tekst ostaje zapis u profilu. Prevod možete ispraviti; vaše izmene se čuvaju i novi automatski prevod ih nikada ne zamenjuje.",
    trMachine: (m, t) => `Mašinski prevod${m ? " (" + m + ")" : ""}, ${t}`, trEdited: (t) => `Vaša izmena, ${t}`, trStaleAuto: "Napravljen je od ranije verzije teksta, pa se ne koristi za poređenje dok se ponovo ne prevede.", trStaleEdited: "Originalni tekst se promenio otkako ste izmenili ovaj prevod. Proverite da li se i dalje slaže.",
    trNone: "Još nema engleske verzije: za poređenje se koristi originalni tekst.", trRun: "Prevedi sada", trSave: "Sačuvaj prevod", trSaved: "Prevod je sačuvan.", trCleared: "Prevod je uklonjen; sledeće čuvanje pravi novi mašinski prevod.", trDone: (n) => `Engleska verzija napravljena za polja: ${n}.`, trNothing: "Sva polja već imaju englesku verziju.", trFailed: "Engleska verzija nije napravljena, pa se za poređenje koristi originalni tekst:",
    trUse: "Koristi se za poređenje", trOrig: "Originalni tekst",
    adminTitle: "Administracija", auAgents: "Potrošnja po funkcijama danas", auAgentsNote: "Neuroni se računaju samo za Workers AI; tokeni za svakog dobavljača. Svaki red je zbir zahteva modelu poslatih za tu funkciju.", auFn: "Funkcija", auAg: { extract: "Čitanje dokumenata", research: "Čitanje veb-sajtova", ideas: "Generisanje projektnih ideja", fit: "Obrazloženje podudarnosti", proposal: "Detaljan predlog projekta", evaluate: "Ocena prema kriterijumima poziva", official: "Provera zvaničnih uslova podobnosti", translate: "Prevodi", improve: "Dorada ideja ispod praga", other: "Ostalo" }, auTitle: "Potrošnja AI danas", auRefresh: "Osveži", auProvider: "Dobavljač i model", auUsed: "Potrošeno", auBudget: "Dnevni budžet", auOfBudget: "Od budžeta", auReq: "Zahtevi",
    auLede: (d, r, s) => `UTC dan ${d}. Dozvoljena potrošnja se obnavlja u ${r} (po beogradskom vremenu). Sajt zaustavlja svakog dobavljača na njegovom budžetu i prelazi na sledećeg; radni prostor organizacija sme da potroši najviše ${s}% svakog budžeta, da bi javni asistent nastavio da radi.`,
    auMsgs: (v, l) => `poruka asistentu od ${v} posetilaca (ograničenje ${l} po posetiocu)`, auActions: (u, l) => `AI radnji u radnom prostoru, ${u} korisnika (ograničenje ${l} po korisniku)`, auRequests: "AI zahteva ukupno",
    auNeurons: "neurona", auTokens: "tokena", auFree: (f) => `besplatno ${f}`, auCached: (n, t) => `Iz sačuvanih odgovora danas: ${n} (${t} tokena koje dobavljači nisu morali da obrade).`, auCacheCol: "Iz sačuvanih odgovora", auOff: "nije podešeno", auUsers: "AI radnje po korisniku", auWeek: "Poslednjih 7 dana", auDay: "Dan (UTC)", admLede: "Zahtevi za premium pristup, korisnici i podešavanja pretplate. Izmene važe odmah.",
    admSt: { none: "Bez zahteva", pending_payment: "Čeka uplatu", payment_submitted: "Uplata prijavljena", active: "Aktivno", rejected: "Odbijeno", revoked: "Opozvano", expired: "Isteklo" },
    admFilter: "Filter zahteva", admOpen: "Na čekanju", admAll: "Svi, sa istorijom", admRequests: "Zahtevi za pristup", admUsers: "Korisnici",
    admWhen: "Zatraženo", admUser: "Korisnik", admPlanCol: "Paket", admStatus: "Status", admJoined: "Registrovan", admRuns: "Generisanja",
    admPaidAt: (t) => `plaćeno ${t}`, admRef: "Poziv na broj", admOld: "stariji zahtev", admGranted: (d) => `odobreno ${d}`, admEnds: (d) => `ističe ${d}`,
    admMailed: "administratoru poslat e-mail", admNotMailed: (e) => `e-mail nije poslat (${e})`, admBy: (e) => `odlučio/la ${e}`,
    admManage: "Upravljaj", admNote: "Napomena (vidi je korisnik)", admDays: "Dana pristupa (prazno = podrazumevano)",
    admApprove: "Odobri i aktiviraj", admMarkPaid: "Označi kao plaćeno", admReject: "Odbij", admRevoke: "Opozovi", admExpire: "Označi kao isteklo", admGrant: "Dodeli pristup",
    admDone: "Sačuvano.", admSave: "Sačuvaj podešavanja", admCsv: "Preuzmi korisnike (CSV)",
    admSettings: "Podešavanja pretplate", admSettingsLede: "Paketi i cene prikazuju se korisnicima onako kako su ovde upisani. Nijedna cena nije upisana u kod.",
    admFree: "Besplatnih generisanja ideja po korisniku", admDaysDefault: "Podrazumevano dana pristupa (prazno = do opoziva)",
    admPlan: "Paket", admPlanId: "Šifra", admPlanName: "Naziv", admPlanPrice: "Cena (kako se prikazuje)", admPricePh: "npr. 49 EUR godišnje", admPlanDesc: "Opis", admAddPlan: "+ Dodaj paket",
    admPay: "Uputstvo za uplatu prikazano posle zahteva (račun, format poziva na broj)",
    errors: { no_official_text: "Za ovaj poziv nema zvaničnog teksta za AI proveru.", no_criteria: "Kriterijumi za dodelu ovog poziva nisu u našim podacima, pa ideja ovde ne može da se oceni.", too_many_reports: "Organizacija je dostigla 200 sačuvanih izveštaja. Prvo obrišite starije.", too_large: "Izveštaj je prevelik za čuvanje.", premium_required: "Za ovo je potreban premium pristup. Pogledajte Premium pristup na strani Projektne ideje.", no_open_request: "Nema otvorenog zahteva za pristup. Prvo zatražite pristup.", signin: "Prijavite se.", role: "Vaša uloga to ne dozvoljava.", not_found: "Nije pronađeno ili nemate pristup.", email: "Unesite ispravnu e-mail adresu.", terms: "Prihvatite obaveštenje o privatnosti.", verification: "Provera zaštite od botova nije uspela. Osvežite stranicu i pokušajte ponovo.", too_many: "Previše zahteva za danas. Pokušajte sutra.", email_unavailable: "E-mail za prijavu trenutno ne može da se pošalje.", ai_user_limit: "Iskoristili ste današnje AI akcije. Obnavljaju se u ponoć po UTC.", ai_resting: "Današnja AI kvota je potrošena. Obnavlja se u ponoć po UTC.", ai_busy: "AI servis je zauzet. Pokušajte za minut.", ai_unavailable: "AI servis nije odgovorio. Pokušajte kasnije.", ai_bad_answer: "Odgovor AI modela nije moguće pročitati. Pokušajte ponovo.", not_below: "Ova ideja nije ispod praga, pa se ne dorađuje.", revision_limit: "Ova ideja je već dva puta dorađena. Umesto toga generišite novu ideju za ovaj poziv.", url_invalid: "Unesite javnu veb-adresu (https://…).", robots_disallow: "robots.txt ovog sajta ne dozvoljava automatsko čitanje stranice.", page_unavailable: "Stranicu nije moguće otvoriti.", pdf_upload_instead: "Ova adresa je PDF: preuzmite ga i otpremite kao dokument.", unsupported_type: "Ova adresa nije veb-stranica.", page_empty: "Na stranici nema čitljivog teksta.", text_too_short: "Premalo teksta za analizu.", last_owner: "Organizacija mora imati bar jednog vlasnika.", transfer_ownership: "Prvo dodelite ulogu vlasnika drugom članu zajedničkih organizacija.", version_conflict: "Neko drugi je u međuvremenu sačuvao profil.", too_many_orgs: "Dostigli ste broj organizacija po nalogu.", google_off: "Prijava preko Google naloga još nije podešena na ovom sajtu.", google_cancelled: "Prijava preko Google naloga je otkazana.", google_state: "Prijava je trajala predugo ili je otvorena u drugoj kartici. Pokušajte ponovo.", google_failed: "Prijava preko Google naloga nije uspela. Pokušajte ponovo.", google_unverified: "Google nije potvrdio ovu e-mail adresu.", email_login_off: "Prijava linkom preko e-pošte nije dostupna.", server_error: "Greška na serveru.", csrf: "Zahtev je blokiran jer dolazi sa drugog sajta. Osvežite stranicu.", db_unavailable: "Baza podataka nije povezana.", network: "Nema veze sa serverom.", ideas_limit: "Vaša organizacija je danas iskoristila dozvoljeni broj generisanja ideja. Pokušajte sutra.", no_calls: "Nijedan izabrani poziv nije otvoren za vašu organizaciju.", profile_incomplete: "Prvo dopunite profil: naziv, vrsta organizacije, država i opis.", data_unavailable: "Podaci o pozivima nisu mogli da se učitaju. Pokušajte kasnije." },
  },
};
const T = (k, ...a) => { const v = k.split(".").reduce((o, x) => (o ? o[x] : undefined), S[L()]) ?? k.split(".").reduce((o, x) => (o ? o[x] : undefined), S.en); return typeof v === "function" ? v(...a) : v ?? k; };
const errText = (e) => T("errors." + (e && e.message)) !== "errors." + (e && e.message) ? T("errors." + e.message) : (e && e.message) || "error";

// Requirement texts (codes from rules.js / call_rules.js).
const appName = (id) => nm((EC.TAX.applicants || []).find((a) => a.id === id)) || id;
const sectorName = (id) => nm((EC.TAX.sectors || []).find((a) => a.id === id)) || id;
const groupName = (id) => nm(TARGET_GROUPS.find((g) => g.id === id)) || id;
const ccName = (cc) => nm((EC.TAX.countries || []).find((c) => c.id === cc)) || cc;
const fieldName = (id) => nm(FIELD[id]) || id;
const listOf = (a, f = (x) => x) => (a || []).map(f).join(", ");
const OFFST = { robots: "the site's robots.txt does not allow automated reading", unavailable: "the document did not open", not_pdf: "the link is not a document", no_section: "no eligibility section was found", no_document: "the Portal names no call document" };
const OFFST_SR = { robots: "robots.txt sajta ne dozvoljava automatsko čitanje", unavailable: "dokument nije mogao da se otvori", not_pdf: "veza ne vodi do dokumenta", no_section: "deo o podobnosti nije pronađen", no_document: "portal ne navodi dokument poziva" };
// Serbian number agreement: 1 / 2-4 / 5 and more (and 11-14 take the last form).
const sr3 = (n, one, few, many) => { n = Math.abs(+n) || 0; return n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many; };
const srYears = (n) => `${n} ${sr3(n, "godinu", "godine", "godina")}`;
const srOther = (n) => `${n} ${sr3(n, "drugoj zemlji", "druge zemlje", "drugih zemalja")}`;
const srNeed = (n) => `${n} ${sr3(n, "druge podobne zemlje", "druge podobne zemlje", "drugih podobnih zemalja")}`;
const consText = (p) => L() === "sr" ? [p.minApplicants ? `najmanje ${p.minApplicants} ${sr3(p.minApplicants, "podnosioca", "podnosioca", "podnosilaca")}` : "", p.minCountries ? `iz ${p.minCountries} ${sr3(p.minCountries, "zemlje", "zemlje", "zemalja")}` : ""].filter(Boolean).join(" ") : [p.minApplicants ? `at least ${p.minApplicants} applicants` : "", p.minCountries ? `from ${p.minCountries} countries` : ""].filter(Boolean).join(" ");
const CODES = {
  en: {
    "country.Y": (p) => `${ccName(p.cc)} is eligible.`, "country.P": (p) => `${ccName(p.cc)} is eligible with a condition. ${p.reason}`, "country.C": (p) => `Eligibility for ${ccName(p.cc)} is not in the source data. ${p.reason}`,
    "country.N": (p) => `${ccName(p.cc)} is not eligible. ${p.reason}`, "country.notListed": (p) => `No eligibility data for ${ccName(p.cc)}.`, "country.missing": () => "Country of establishment is missing from the profile.",
    "applicant.listed": (p) => `Your organisation type is among the applicant types for this call (${listOf(p.listed, appName)}). ${p.note || ""}`, "applicant.notStated": () => "The call data does not state applicant types.",
    "applicant.informal": () => "An informal group is not a legal entity: check whether the call accepts such applicants.", "applicant.individualsOnly": (p) => `This call is for individuals (${listOf(p.listed, appName)}), not organisations.`,
    "applicant.notListed": (p) => `Your organisation type is not among the listed applicant types (${listOf(p.listed, appName)}). Check the call conditions.`, "applicant.missing": () => "Organisation type is missing from the profile.",
    "partnership.individual": () => "Individual applications only.", "partnership.alone": () => "A single applicant can apply.", "partnership.unspecified": () => "The call data states no consortium requirement. Check the call conditions.",
    "partnership.consortiumMet": (p) => `Consortium required: your profile lists partners in ${p.have} other countries (needed: ${p.need}).`,
    "partnership.consortiumGap": (p) => `Consortium required${p.need ? `: partners from at least ${p.need} other eligible countries` : ""}. Your profile lists partners in ${p.have}. ${p.note || ""}`,
    "partnership.consortiumMissing": (p) => `Consortium required; the profile has no partner information. ${p.note || ""}`,
    "rule.established.pass": (p) => `Legally established at least ${p.years} years before the deadline: established in ${p.year}.`, "rule.established.fail": (p) => `Must be legally established at least ${p.years} years before the deadline (${String(p.deadline).slice(0, 10)}); established in ${p.year}.`,
    "rule.established.date": (p) => `Must be legally established at least ${p.years} years before the deadline (${String(p.deadline).slice(0, 10)}); established in ${p.year}: the exact registration date decides.`, "rule.established.missing": (p) => `Must be legally established at least ${p.years} years before the deadline; the year of establishment is missing.`,
    "rule.engo": () => "The applicant must be a European NGO active in education and training or youth.", "rule.heis.warn": () => "This action is for higher education institutions and your organisation is not one. This can disqualify the application: check the call document.",
    "rule.heis.pass": () => "Higher education institution, as the action requires.", "rule.heis.missing": () => "Organisation type is missing; this action is for higher education institutions.",
    "str.sectors": (p) => `Shared areas of activity: ${listOf(p.sectors, sectorName)}.`, "str.words": (p) => `Words shared with the call text: ${p.words.join(", ")}.`, "str.groups": (p) => `The call mentions your target groups: ${listOf(p.groups, groupName)}.`,
    "str.experience": (p) => `Experience as ${p.role === "both" ? "partner and coordinator" : p.role} in ${p.programme === "ERASMUS" ? "Erasmus+" : "EU-funded"} projects.`, "str.capacity": () => "Team size fits the size of the grant.", "str.country": (p) => `${ccName(p.cc)} is fully eligible.`,
    "off.unverified": (p) => (p.status === "not_researched" ? "Eligible Calls does not read the official documents of this call (it is published outside the EU Funding & Tenders Portal and UKRI). The mandatory conditions are not verified: read them in the call's own documents." : `The official eligibility text could not be read (${OFFST[p.status] || p.status}). The mandatory conditions are not verified: read them in the call document.`),
    "off.read": (p) => `The official eligibility text was read (${p.title}). None of the conditions that can be checked automatically excludes your organisation; the AI check below lists them all.`,
    "off.country.pass": (p) => `${ccName(p.cc)} is among the eligible countries listed in the call document.`, "off.country.fail": (p) => `The call document lists the eligible countries and ${ccName(p.cc)} is not among them.`,
    "off.natural.pass": () => "Natural persons are not eligible; your organisation applies as an organisation.", "off.natural.fail": () => "Natural persons are not eligible for this call.", "off.natural.missing": () => "Natural persons are not eligible; the organisation type is missing in the profile.",
    "off.legal.fail": () => "Applicants must be legal entities; an informal group is not one.", "off.legal.exceptional": () => "Applicants must be legal entities; entities without legal personality may take part only exceptionally, if their representatives can take on legal obligations for them.",
    "off.coordinator.forProfit": () => "The coordinator (lead applicant) must be a non-profit entity: a for-profit organisation can take part only as a co-applicant.", "off.forProfit.partner": () => "For-profit organisations may apply only in partnership with public or non-profit organisations.",
    "off.public.pass": () => "The call is for public bodies; your organisation type is one.", "off.public.check": () => "The call is for public bodies: check whether your organisation qualifies.",
    "off.consortium.met": (p) => `Consortium required (${consText(p)}): your profile lists partners in ${p.have} other countries.`, "off.consortium.gap": (p) => `Consortium required (${consText(p)}): you will need partners from at least ${p.need} other countries; your profile lists ${p.have}.`,
    "off.consortium.missing": (p) => `Consortium required (${consText(p)}); the profile has no partner information.`, "off.consortium.single": () => "A single applicant may apply.",
    "off.ai": (p) => `${p.condition}${p.reason ? ". " + p.reason : ""}`,
    "rec.verifyOfficial": () => "Read the eligibility section of the official call document before applying: it could not be verified here.", "rec.officialWarn": () => "The official document sets a condition that may limit your role: see the quoted text.",
    "rec.notEligible": () => "A mandatory requirement is not met. Unless the call document says otherwise, focus on other calls.", "rec.complete": (p) => `Complete the profile: ${listOf(p.fields, fieldName)}.`,
    "rec.checkCountry": (p) => `Read the eligible-countries section of the call for ${ccName(p.cc)}.`, "rec.checkApplicant": () => "Confirm in the call conditions that your type of organisation can apply.",
    "rec.partners": (p) => `Find partners${p.need ? ` from at least ${p.need} other eligible countries` : ""} well before the deadline.`, "rec.rule": () => "Verify the quoted requirement in the official text.",
    "rec.groups": () => "Explain in the proposal how your target groups relate to the beneficiaries named in the call.", "rec.readDocument": () => "The source shows only part of the conditions: read the call document.", "rec.officialPage": () => "Open the official call page; it prevails over this assessment.",
  },
  sr: {
    "country.Y": (p) => `Država ${ccName(p.cc)} je podobna.`, "country.P": (p) => `Država ${ccName(p.cc)} je podobna uz uslov. ${p.reason}`, "country.C": (p) => `Podobnost za ${ccName(p.cc)} nije navedena u izvornim podacima. ${p.reason}`,
    "country.N": (p) => `Država ${ccName(p.cc)} nije podobna. ${p.reason}`, "country.notListed": (p) => `Nema podataka o podobnosti za ${ccName(p.cc)}.`, "country.missing": () => "U profilu nedostaje država sedišta.",
    "applicant.listed": (p) => `Vrsta vaše organizacije je među podnosiocima za ovaj poziv (${listOf(p.listed, appName)}). ${p.note || ""}`, "applicant.notStated": () => "Podaci o pozivu ne navode vrste podnosilaca.",
    "applicant.informal": () => "Neformalna grupa nije pravno lice: proverite da li poziv prihvata takve podnosioce.", "applicant.individualsOnly": (p) => `Poziv je namenjen pojedincima (${listOf(p.listed, appName)}), ne organizacijama.`,
    "applicant.notListed": (p) => `Vrsta vaše organizacije nije među navedenim podnosiocima (${listOf(p.listed, appName)}). Proverite uslove poziva.`, "applicant.missing": () => "U profilu nedostaje vrsta organizacije.",
    "partnership.individual": () => "Samo pojedinačne prijave.", "partnership.alone": () => "Može da konkuriše jedan podnosilac.", "partnership.unspecified": () => "Podaci o pozivu ne navode uslov konzorcijuma. Proverite uslove poziva.",
    "partnership.consortiumMet": (p) => `Potreban konzorcijum: profil navodi partnere u ${srOther(p.have)} (potrebno: ${p.need}).`,
    "partnership.consortiumGap": (p) => `Potreban konzorcijum${p.need ? `: partneri iz najmanje ${srNeed(p.need)}` : ""}. Profil navodi partnere u ${p.have}. ${p.note || ""}`,
    "partnership.consortiumMissing": (p) => `Potreban konzorcijum; profil nema podatke o partnerima. ${p.note || ""}`,
    "rule.established.pass": (p) => `Pravno osnovana najmanje ${srYears(p.years)} pre roka: osnovana ${p.year}.`, "rule.established.fail": (p) => `Mora biti pravno osnovana najmanje ${srYears(p.years)} pre roka (${String(p.deadline).slice(0, 10)}); osnovana ${p.year}.`,
    "rule.established.date": (p) => `Mora biti pravno osnovana najmanje ${srYears(p.years)} pre roka (${String(p.deadline).slice(0, 10)}); osnovana ${p.year}: odlučuje tačan datum registracije.`, "rule.established.missing": (p) => `Mora biti pravno osnovana najmanje ${srYears(p.years)} pre roka; godina osnivanja nedostaje.`,
    "rule.engo": () => "Podnosilac mora biti evropska nevladina organizacija aktivna u obrazovanju i obuci ili radu sa mladima.", "rule.heis.warn": () => "Ova aktivnost je namenjena visokoškolskim ustanovama, a vaša organizacija to nije. To može diskvalifikovati prijavu: proverite dokument poziva.",
    "rule.heis.pass": () => "Visokoškolska ustanova, kako aktivnost zahteva.", "rule.heis.missing": () => "Vrsta organizacije nedostaje; aktivnost je namenjena visokoškolskim ustanovama.",
    "str.sectors": (p) => `Zajedničke oblasti delovanja: ${listOf(p.sectors, sectorName)}.`, "str.words": (p) => `Reči zajedničke sa tekstom poziva: ${p.words.join(", ")}.`, "str.groups": (p) => `Poziv pominje vaše ciljne grupe: ${listOf(p.groups, groupName)}.`,
    "str.experience": (p) => `Iskustvo kao ${p.role === "both" ? "partner i koordinator" : p.role === "coordinator" ? "koordinator" : "partner"} u ${p.programme === "ERASMUS" ? "Erasmus+" : "EU"} projektima.`, "str.capacity": () => "Veličina tima odgovara veličini granta.", "str.country": (p) => `Država ${ccName(p.cc)} je u potpunosti podobna.`,
    "off.unverified": (p) => (p.status === "not_researched" ? "Eligible Calls ne čita zvanična dokumenta ovog poziva (objavljen je van portala EU Funding & Tenders i UKRI). Obavezni uslovi nisu provereni: pročitajte ih u dokumentima poziva." : `Zvanični tekst o podobnosti nije mogao da se pročita (${OFFST_SR[p.status] || p.status}). Obavezni uslovi nisu provereni: pročitajte ih u dokumentu poziva.`),
    "off.read": (p) => `Zvanični tekst o podobnosti je pročitan (${p.title}). Nijedan uslov koji može automatski da se proveri ne isključuje vašu organizaciju; AI provera ispod navodi sve uslove.`,
    "off.country.pass": (p) => `Država ${ccName(p.cc)} je među podobnim državama navedenim u dokumentu poziva.`, "off.country.fail": (p) => `Dokument poziva navodi podobne države, a ${ccName(p.cc)} nije među njima.`,
    "off.natural.pass": () => "Fizička lica nisu podobna; vaša organizacija konkuriše kao organizacija.", "off.natural.fail": () => "Fizička lica nisu podobna za ovaj poziv.", "off.natural.missing": () => "Fizička lica nisu podobna; u profilu nedostaje vrsta organizacije.",
    "off.legal.fail": () => "Podnosioci moraju biti pravna lica; neformalna grupa to nije.", "off.legal.exceptional": () => "Podnosioci moraju biti pravna lica; subjekti bez pravnog subjektiviteta mogu da učestvuju samo izuzetno, ako njihovi predstavnici mogu da preuzmu pravne obaveze za njih.",
    "off.coordinator.forProfit": () => "Koordinator (glavni podnosilac) mora biti neprofitna organizacija: profitna organizacija može da učestvuje samo kao partner.", "off.forProfit.partner": () => "Profitne organizacije mogu da konkurišu samo u partnerstvu sa javnim ili neprofitnim organizacijama.",
    "off.public.pass": () => "Poziv je namenjen javnim telima; vaša vrsta organizacije to jeste.", "off.public.check": () => "Poziv je namenjen javnim telima: proverite da li vaša organizacija ispunjava uslov.",
    "off.consortium.met": (p) => `Potreban konzorcijum (${consText(p)}): profil navodi partnere u ${srOther(p.have)}.`, "off.consortium.gap": (p) => `Potreban konzorcijum (${consText(p)}): biće vam potrebni partneri iz najmanje ${srNeed(p.need)}; profil navodi ${p.have}.`,
    "off.consortium.missing": (p) => `Potreban konzorcijum (${consText(p)}); profil nema podatke o partnerima.`, "off.consortium.single": () => "Može da konkuriše jedan podnosilac.",
    "off.ai": (p) => `${p.condition}${p.reason ? ". " + p.reason : ""}`,
    "rec.verifyOfficial": () => "Pre prijave pročitajte deo o podobnosti u zvaničnom dokumentu poziva: ovde nije mogao da se proveri.", "rec.officialWarn": () => "Zvanični dokument postavlja uslov koji može da ograniči vašu ulogu: pogledajte citirani tekst.",
    "rec.notEligible": () => "Obavezan uslov nije ispunjen. Osim ako dokument poziva ne kaže drugačije, usmerite se na druge pozive.", "rec.complete": (p) => `Dopunite profil: ${listOf(p.fields, fieldName)}.`,
    "rec.checkCountry": (p) => `Pročitajte deo poziva o podobnim zemljama za ${ccName(p.cc)}.`, "rec.checkApplicant": () => "Potvrdite u uslovima poziva da vaša vrsta organizacije može da konkuriše.",
    "rec.partners": (p) => `Pronađite partnere${p.need ? ` iz najmanje ${srNeed(p.need)}` : ""} na vreme pre roka.`, "rec.rule": () => "Proverite citirani uslov u zvaničnom tekstu.",
    "rec.groups": () => "U predlogu objasnite kako su vaše ciljne grupe povezane sa korisnicima koje poziv navodi.", "rec.readDocument": () => "Izvor prikazuje samo deo uslova: pročitajte dokument poziva.", "rec.officialPage": () => "Otvorite zvaničnu stranicu poziva; ona je merodavna.",
  },
};
const codeText = (x) => { const f = CODES[L()][x.code] || CODES.en[x.code]; return f ? f(x.params || {}).trim() : x.code; };

/* ---------- operation status ---------- */
// What the page is doing right now, tied to the real asynchronous work: nothing is shown while idle; a busy state
// (reading, ocr, analysing, researching, generating, drawing, saving) shows the moving mark and, where the work can
// be counted (pages read, OCR progress, parts analysed), a progress bar; completed and failed end the animation.
const OP_BUSY = new Set(["uploading", "reading", "ocr", "analysing", "researching", "generating", "drawing", "saving", "checking", "translating"]);
// The loading animation is kept for work that takes seconds (documents, AI, PDF); a quick save shows only its text.
const OP_ANIM = new Set(["uploading", "reading", "ocr", "analysing", "researching", "generating", "drawing", "checking", "translating"]);
// AI work that takes seconds to minutes: the status shows how long it has been running.
const OP_TIMED = new Set(["generating", "analysing", "checking", "translating", "researching"]);
function opState(el, state, detail = "", pct = null) {
  if (!el) return;
  if (el._opTimer) { clearInterval(el._opTimer); el._opTimer = null; }
  if (state === "idle") { el.className = "op"; el.removeAttribute("aria-busy"); el.innerHTML = ""; return; }
  const busy = OP_BUSY.has(state), p = pct === null || pct === undefined || isNaN(pct) ? null : Math.max(0, Math.min(100, Math.round(pct)));
  el.className = `op op-${state}${busy ? " busy" : ""}${busy && p === null ? " sweep" : ""}`;
  el.setAttribute("aria-busy", busy ? "true" : "false");
  if (busy && OP_TIMED.has(state)) {
    const t0 = el._opStart && el._opState === state ? el._opStart : Date.now();
    el._opStart = t0; el._opState = state;
    el._opTimer = setInterval(() => {
      const tm = el.isConnected && el.querySelector(".op-time");
      if (!tm) { clearInterval(el._opTimer); el._opTimer = null; return; }
      const s = Math.floor((Date.now() - t0) / 1000); tm.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    }, 1000);
  } else { el._opStart = null; el._opState = null; }
  el.innerHTML = `${busy && !OP_ANIM.has(state) ? "" : `<span class="op-ic${busy ? " ec-loader" : ""}" aria-hidden="true"></span>`}<span class="op-t"><b>${esc(T("op." + state))}</b>${detail ? ` <span>${esc(detail)}</span>` : ""}</span>${p !== null ? `<span class="op-bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></span><span class="fine num">${p}%</span>` : ""}${busy && OP_TIMED.has(state) ? `<span class="op-time fine num" aria-hidden="true">0:00</span>` : ""}`;
}
// Placeholder cards with a soft shimmer where generated ideas will appear, one per selected call.
const ideaSkeletons = (n) => `<div class="skel-list" aria-hidden="true">${Array.from({ length: Math.max(1, Math.min(n, 3)) }, () =>
  `<div class="skel-card"><i class="sk w40"></i><i class="sk w90"></i><i class="sk w75"></i><i class="sk w60"></i></div>`).join("")}</div>`;

/* ---------- API ---------- */
async function api(method, path, body) {
  let r;
  try { r = await fetch("/api" + path, { method, credentials: "same-origin", headers: { "content-type": "application/json", "x-requested-with": "eligiblecalls" }, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw Object.assign(new Error("network"), { status: 0 }); }
  let j = null; try { j = await r.json(); } catch { /* not JSON */ }
  if (method !== "GET" && /^\/orgs\//.test(path) && AI_PATH.test(path)) aiRefresh();
  if (!r.ok) throw Object.assign(new Error((j && j.error) || "server_error"), { status: r.status, data: j });
  return j;
}
// Requests that can use AI actions; after each one the "AI actions left" line is read again (one small request).
const AI_PATH = /\/(extract|research|ideas|evaluate|evaluation|official-checks|fit-explanation|proposal|translation|translate|improve)(\/|$)/;
let aiTimer = null;
function aiRefresh() {
  clearTimeout(aiTimer);
  aiTimer = setTimeout(async () => {
    try { const a = await api("GET", "/me/ai"); if (ST.me && ST.me.user) ST.me.ai = a; aiLeftDraw(); } catch { /* keeps the last value */ }
  }, 400);
}
const aiLeftText = () => {
  const a = ST.me && ST.me.ai;
  if (!a) return "";
  const t = new Intl.DateTimeFormat(L() === "sr" ? "sr-Latn-RS" : "en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(a.resetAt));
  return T("aiLeft", a.left, a.limit, t);
};
function aiLeftDraw() { const el = document.getElementById("oiAiLeft"); if (el) { el.textContent = aiLeftText(); el.classList.toggle("bad", !!(ST.me && ST.me.ai && ST.me.ai.left === 0)); } }

/* ---------- state ---------- */
const ST = { me: undefined, org: null, results: null, resultsKey: "", stats: null, statsGen: "", filters: { status: "", prog: "", dl: "", high: false, sort: "score", shown: 30 }, review: null, guide: null, evalSel: {}, compare: new Set() };
const app = () => document.getElementById("app");
const go = (h) => { if (location.hash === "#" + h) EC.route(); else location.hash = h; };
const fmtTime = (ms) => new Intl.DateTimeFormat(L() === "sr" ? "sr-Latn-RS" : "en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));

async function loadMe(force) { if (ST.me === undefined || force) { try { ST.me = await api("GET", "/me"); } catch (e) { ST.me = { user: null, error: e.message }; } } return ST.me; }
// Official eligibility conditions of all calls (site/org/eligibility.json, ingest/eligibility_docs.py), loaded once.
// Serbian to English glossary for the thematic match (site/org/glossary-sr-en.json), loaded once.
async function loadGlossary() {
  if (ST.gloss === undefined) { try { const r = await fetch("org/glossary-sr-en.json", { cache: "no-cache" }); ST.gloss = r.ok ? await r.json() : null; } catch { ST.gloss = null; } if (ST.gloss) setGlossary(ST.gloss); }
  return ST.gloss;
}
async function loadElig() {
  if (ST.elig === undefined) { try { const r = await fetch("org/eligibility.json", { cache: "no-cache" }); ST.elig = r.ok ? await r.json() : null; } catch { ST.elig = null; } }
  return ST.elig;
}
// AI checks of this organisation's profile against official texts; only those made with the current profile count.
async function loadOfficial(id) {
  try { ST.off = (await api("GET", `/orgs/${id}/official-checks`)).checks; } catch { ST.off = []; }
  ST.offKey = ST.off.map((x) => x.callId + ":" + x.at).join("|");
}
const aiMap = () => Object.fromEntries((ST.off || []).filter((x) => x.profileVersion === ST.org.version).map((x) => [x.callId, x.conditions.map((c) => ({ ...c, title: x.source.title, url: x.source.url }))]));
const assessOpts = () => ({ stats: ST.stats || buildDF(activeCalls()), elig: ST.elig || null, ai: aiMap() });
async function loadOrg(id, force) {
  if (!force && ST.org && ST.org.id === id) return ST.org;
  const [org] = await Promise.all([api("GET", "/orgs/" + id), loadElig(), loadOfficial(id), loadGlossary()]);
  ST.org = org; ST.review = null;
  try { localStorage.setItem("konkursi.org", JSON.stringify(id)); } catch {}
  return ST.org;
}
const canEdit = () => ST.org && (ST.org.role === "owner" || ST.org.role === "editor");

function activeCalls() { return (EC.CALLS || []).filter((c) => EC.isOpen(c)); }
// The profile as matching sees it: with the English copies of its free text where they exist (src/org/translate.js).
// One object per profile version and set of copies, so the rules engine's per-profile memo works.
function matchProfile() {
  const o = ST.org, te = (o.translation && o.translation.textEn) || {};
  const key = o.id + "@" + o.version + "@" + textHash(JSON.stringify(te));
  if (ST.mpKey !== key) { ST.mp = Object.keys(te).length ? { ...o.profile, textEn: te } : o.profile; ST.mpKey = key; }
  return ST.mp;
}
function results() {
  const calls = activeCalls();
  matchProfile();
  const key = ST.org.id + "@" + ST.org.version + "@" + EC.META.generated + "@" + calls.length + "@" + (ST.elig ? ST.elig.generated : "-") + "@" + (ST.offKey || "") + "@" + ST.mpKey + "@" + glossaryVersion();
  if (ST.resultsKey === key && ST.results) return ST.results;
  if (ST.statsGen !== EC.META.generated) { ST.stats = buildDF(calls); ST.statsGen = EC.META.generated; }
  const byId = new Map(calls.map((c) => [c.id, c]));
  ST.results = assessAll(matchProfile(), calls, assessOpts()).map((r) => ({ ...r, call: byId.get(r.callId) }));
  ST.resultsKey = key; ST.resultsAt = Date.now();
  return ST.results;
}

/* ---------- entry ---------- */
async function render(h) {
  try {
    if (h.startsWith("signin=")) return renderSignin(h.slice(7));
    const parts = h.split("/");
    const me = await loadMe(parts[1] === "signin-error");
    if (!me.user) return renderLogin(parts[1] === "signin-error" ? parts[2] : me.error, me.signin);
    if (parts[1] === "signin-error") return location.replace("#org");
    if (h === "org") {
      if (!me.orgs.length) return renderCreate();
      let last = null; try { last = JSON.parse(localStorage.getItem("konkursi.org")); } catch {}
      const id = me.orgs.some((o) => o.id === last) ? last : me.orgs[0].id;
      return location.replace("#org/" + id);
    }
    if (parts[1] === "new") return renderCreate();
    if (parts[1] === "admin") return await renderAdmin(parts.slice(2));
    const id = parts[1];
    let sec = parts[2] || "overview", arg = parts.slice(3).join("/");
    if (!ST.quiet) shell(id, sec, `<div class="page-wait" role="status" aria-busy="true">${esc(T("loadingPage"))}</div>`);
    await loadOrg(id);
    const body = await ({ overview: secOverview, profile: secProfile, documents: secDocuments, matching: secMatching, match: secReport, ideas: secIdeas, evaluation: secEvaluation, reports: secReports, settings: secSettings }[sec] || secOverview)(arg);
    shell(id, sec === "match" ? "matching" : sec === "report" ? "reports" : sec, body);
    afterRender[sec] && afterRender[sec](arg);
  } catch (e) {
    if (e.status === 401) { ST.me = undefined; return renderLogin(null, (await loadMe(true)).signin); }
    app().innerHTML = `<div class="wrap page"><h1>${esc(T("title"))}</h1><p class="note err">${esc(errText(e))}</p><p><a href="#org">${esc(T("nav.overview"))}</a></p></div>`;
  }
}

// Shows the result of an action on the page the user is on: the page is drawn again without the loading placeholder,
// at the same scroll position and with the same sections open. (refresh() is a navigation: it starts at the top.)
function detailsKey(d, i) { const c = d.closest("[data-idea]"); return (c ? c.dataset.idea : "") + ":" + (d.id || d.dataset.ev || d.querySelector("summary") && d.querySelector("summary").textContent.replace(/[\d.,/%\s]+/g, " ").trim().slice(0, 40) || i); }
let refreshing = null;
function refresh() {
  if (refreshing) return refreshing;
  const y = scrollY, open = new Set([...app().querySelectorAll("details")].map((d, i) => (d.open ? detailsKey(d, i) : null)).filter(Boolean));
  ST.quiet = true;
  refreshing = render(decodeURIComponent(location.hash.slice(1))).finally(() => {
    ST.quiet = false; refreshing = null;
    app().querySelectorAll("details").forEach((d, i) => { if (open.has(detailsKey(d, i))) d.open = true; });
    scrollTo(0, y);
  });
  return refreshing;
}
EC.refresh = refresh;

function shell(id, sec, body) {
  const me = ST.me, org = ST.org && ST.org.id === id ? ST.org : null;
  const items = ["overview", "profile", "documents", "matching", "ideas", "evaluation", "reports", "settings"];
  const soon = new Set();
  app().innerHTML = `<div class="wrap oi">
    <aside class="oi-side">
      <div class="oi-org"><span class="eyebrow">${esc(T("title"))}</span><span class="n">${esc(org ? org.name : "")}</span>
        ${me.orgs.length > 1 ? `<select id="oiSwitch" aria-label="Organisation">${me.orgs.map((o) => `<option value="${o.id}"${o.id === id ? " selected" : ""}>${esc(o.name)}</option>`).join("")}</select>` : ""}
        <span class="fine">${esc(me.user.email)}${org ? " · " + esc(T("roles." + org.role)) : ""}</span>
        <span class="fine${me.ai && me.ai.left === 0 ? " bad" : ""}" id="oiAiLeft">${esc(aiLeftText())}</span></div>
      <nav class="oi-nav" aria-label="${esc(T("title"))}">${items.map((s) => `<a href="#org/${id}/${s}"${s === sec ? ' aria-current="page"' : ""}>${esc(T("nav." + s))}${soon.has(s) ? `<span class="soon">${esc(T("soon"))}</span>` : ""}</a>`).join("")}</nav>
      <div class="fine"><a href="#org/new">${esc(T("newOrg"))}</a>${me.user.admin ? ` · <a href="#org/admin">${esc(T("adminTitle"))}</a>` : ""} · <button type="button" class="linkbtn" id="oiOut">${esc(T("signOut"))}</button></div>
    </aside>
    <div class="oi-main">${body}</div></div>`;
  const sw = document.getElementById("oiSwitch"); if (sw) sw.addEventListener("change", () => go("org/" + sw.value + "/" + sec));
  bindAccount();
}
const afterRender = {};

/* ---------- administrator: premium access requests, users, subscription settings ---------- */
const ADM_ST = ["pending_payment", "payment_submitted", "active", "rejected", "revoked", "expired"];
const dOnly = (ms) => (ms ? new Intl.DateTimeFormat(L() === "sr" ? "sr-Latn-RS" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(ms)) : "");
const stBadge = (st) => `<span class="st st-${esc(st)}">${esc(T("admSt." + st))}</span>`;
async function renderAdmin(parts) {
  const me = ST.me;
  if (!me.user.admin) { app().innerHTML = `<div class="wrap page"><h1>${esc(T("adminTitle"))}</h1><p class="note err">${esc(T("errors.not_found"))}</p><p><a href="#org">${esc(T("nav.overview"))}</a></p></div>`; return; }
  app().innerHTML = `<div class="wrap page adm"><div class="page-wait" role="status" aria-busy="true">${esc(T("loadingPage"))}</div></div>`;
  const [d, u] = await Promise.all([api("GET", "/admin/access"), api("GET", "/admin/usage").catch(() => null)]);
  const focus = parts[0] === "r" ? parts[1] : null;
  const f = ST.admFilter || "open";
  const isOpen = (r) => r.effective === "pending_payment" || r.effective === "payment_submitted";
  const counts = Object.fromEntries(ADM_ST.map((k) => [k, d.requests.filter((r) => r.current && r.effective === k).length]));
  const shown = d.requests.filter((r) => r.id === focus || (f === "open" ? isOpen(r) && r.current : f === "all" ? true : r.current && r.effective === f));
  const set = d.settings;
  const planName = (id) => { const pl = set.plans.find((x) => x.id === id); return pl ? pl.name + (pl.price ? " · " + pl.price : "") : id || ""; };
  const reqRow = (r) => `<tr id="ar-${esc(r.id)}"${r.id === focus ? ' class="hl"' : ""}>
      <td>${esc(fmtTime(r.requestedAt))}${r.paidAt ? `<div class="fine">${esc(T("admPaidAt", fmtTime(r.paidAt)))}</div>` : ""}</td>
      <td>${r.name ? `<b>${esc(r.name)}</b><div class="fine">${esc(r.email)}</div>` : `<b>${esc(r.email)}</b>`}${r.org ? `<div class="fine">${esc(r.org)}</div>` : ""}</td>
      <td>${esc(planName(r.plan))}${r.paymentRef ? `<div class="fine">${esc(T("admRef"))}: ${esc(r.paymentRef)}</div>` : ""}</td>
      <td>${stBadge(r.effective)}${r.current ? "" : `<div class="fine">${esc(T("admOld"))}</div>`}${r.grantedAt ? `<div class="fine">${esc(T("admGranted", dOnly(r.grantedAt)))}</div>` : ""}${r.expiresAt ? `<div class="fine">${esc(T("admEnds", dOnly(r.expiresAt)))}</div>` : ""}
        <div class="fine">${r.notified ? esc(T("admMailed")) : `<span class="bad">${esc(T("admNotMailed", r.notifyError || "-"))}</span>`}</div>${r.decidedBy ? `<div class="fine">${esc(T("admBy", r.decidedBy))}</div>` : ""}${r.adminNote ? `<div class="fine">“${esc(r.adminNote)}”</div>` : ""}</td>
      <td><details class="adm-act"${r.id === focus ? " open" : ""}><summary>${esc(T("admManage"))}</summary>
        <div class="fld"><label for="an-${esc(r.id)}">${esc(T("admNote"))}</label><input type="text" id="an-${esc(r.id)}" maxlength="1000" value="${esc(r.adminNote)}"></div>
        <div class="fld"><label for="ad-${esc(r.id)}">${esc(T("admDays"))}</label><input type="number" id="ad-${esc(r.id)}" min="1" max="3660" placeholder="${set.accessDays || "∞"}"></div>
        <div class="oi-row">${r.effective !== "active" ? `<button type="button" class="btn" data-ra="approve" data-id="${esc(r.id)}">${esc(T("admApprove"))}</button>` : ""}
          ${r.effective === "pending_payment" ? `<button type="button" class="btn quiet" data-ra="paid" data-id="${esc(r.id)}">${esc(T("admMarkPaid"))}</button>` : ""}
          ${isOpen(r) ? `<button type="button" class="btn ghost" data-ra="reject" data-id="${esc(r.id)}">${esc(T("admReject"))}</button>` : ""}
          ${r.effective === "active" ? `<button type="button" class="btn ghost" data-ra="revoke" data-id="${esc(r.id)}">${esc(T("admRevoke"))}</button><button type="button" class="btn ghost" data-ra="expire" data-id="${esc(r.id)}">${esc(T("admExpire"))}</button>` : ""}</div>
      </details></td></tr>`;
  const userRow = (u) => `<tr><td>${u.name ? `<b>${esc(u.name)}</b><div class="fine">${esc(u.email)}</div>` : `<b>${esc(u.email)}</b>`}</td><td>${esc(dOnly(u.createdAt))}</td><td class="num">${u.ideaRuns}</td>
      <td>${stBadge(u.status)}${u.grantedAt && u.status === "active" ? `<div class="fine">${esc(T("admGranted", dOnly(u.grantedAt)))}</div>` : ""}${u.expiresAt && u.status === "active" ? `<div class="fine">${esc(T("admEnds", dOnly(u.expiresAt)))}</div>` : ""}</td>
      <td>${u.status === "active" ? `<button type="button" class="btn ghost" data-ua="revoke" data-uid="${esc(u.id)}">${esc(T("admRevoke"))}</button>` : `<button type="button" class="btn quiet" data-ua="grant" data-uid="${esc(u.id)}">${esc(T("admGrant"))}</button>`}</td></tr>`;
  const planRow = (pl, i) => `<fieldset class="adm-plan" data-plan="${i}"><legend>${esc(T("admPlan"))} ${i + 1}</legend>
      <div class="fld"><label>${esc(T("admPlanId"))}<input type="text" data-k="id" maxlength="40" value="${esc(pl.id)}"></label></div>
      <div class="fld"><label>${esc(T("admPlanName"))}<input type="text" data-k="name" maxlength="80" value="${esc(pl.name)}"></label></div>
      <div class="fld"><label>${esc(T("admPlanPrice"))}<input type="text" data-k="price" maxlength="80" value="${esc(pl.price)}" placeholder="${esc(T("admPricePh"))}"></label></div>
      <div class="fld"><label>${esc(T("admPlanDesc"))}<textarea data-k="description" rows="2" maxlength="600">${esc(pl.description)}</textarea></label></div>
      ${set.plans.length > 1 ? `<button type="button" class="linkbtn" data-rmplan="${i}">${esc(T("del"))}</button>` : ""}</fieldset>`;
  app().innerHTML = `<div class="wrap page adm">
    <p class="fine"><a href="#org">← ${esc(T("nav.overview"))}</a> · <a href="/api/admin/users.csv">${esc(T("admCsv"))}</a></p>
    <h1>${esc(T("adminTitle"))}</h1><p class="lede">${esc(T("admLede"))}</p>
    ${usageHTML(u)}
    <div class="adm-f" role="group" aria-label="${esc(T("admFilter"))}">${["open", ...ADM_ST, "all"].map((k) => `<button type="button" class="chip${k === f ? " on" : ""}" data-f="${k}" aria-pressed="${k === f}">${esc(k === "open" ? T("admOpen") : k === "all" ? T("admAll") : T("admSt." + k))}${k === "open" ? ` (${counts.pending_payment + counts.payment_submitted})` : k === "all" ? "" : ` (${counts[k]})`}</button>`).join("")}</div>
    <section class="oi-card"><h2>${esc(T("admRequests"))}</h2><div role="status" id="admMsg"></div>
      ${shown.length ? `<div class="tscroll"><table class="oi-t adm-t"><thead><tr><th>${esc(T("admWhen"))}</th><th>${esc(T("admUser"))}</th><th>${esc(T("admPlanCol"))}</th><th>${esc(T("admStatus"))}</th><th></th></tr></thead><tbody>${shown.map(reqRow).join("")}</tbody></table></div>` : `<p class="fine">${esc(T("none"))}</p>`}</section>
    <section class="oi-card"><h2>${esc(T("admUsers"))} (${d.users.length})</h2>
      <div class="tscroll"><table class="oi-t adm-t"><thead><tr><th>${esc(T("admUser"))}</th><th>${esc(T("admJoined"))}</th><th>${esc(T("admRuns"))}</th><th>${esc(T("admStatus"))}</th><th></th></tr></thead><tbody>${d.users.map(userRow).join("")}</tbody></table></div><div role="status" id="admUMsg"></div></section>
    <section class="oi-card"><h2>${esc(T("admSettings"))}</h2><p class="fine">${esc(T("admSettingsLede"))}</p>
      <form id="admSet">
        <div class="oi-cols"><div class="fld"><label for="asFree">${esc(T("admFree"))}</label><input type="number" id="asFree" min="0" max="100" value="${set.freeIdeaRuns}"></div>
        <div class="fld"><label for="asDays">${esc(T("admDaysDefault"))}</label><input type="number" id="asDays" min="1" max="3660" value="${set.accessDays || ""}" placeholder="∞"></div></div>
        <div id="asPlans">${set.plans.map(planRow).join("")}</div>
        <p><button type="button" class="linkbtn" id="asAdd">${esc(T("admAddPlan"))}</button></p>
        <div class="fld"><label for="asPay">${esc(T("admPay"))}</label><textarea id="asPay" rows="4" maxlength="2000">${esc(set.paymentInstructions)}</textarea></div>
        <div class="oi-row"><button class="btn" type="submit">${esc(T("admSave"))}</button></div><div role="status" id="asMsg"></div>
      </form></section></div>`;
  bindAccount();
  const ur = document.getElementById("auRefresh"); if (ur) ur.addEventListener("click", () => renderAdmin(parts));
  document.querySelectorAll("[data-f]").forEach((b) => b.addEventListener("click", () => { ST.admFilter = b.dataset.f; renderAdmin([]); }));
  const busy = async (el, out, fn) => { el.disabled = true; opState(out, "saving"); try { await fn(); ST.admNote = T("admDone"); await renderAdmin(parts); } catch (e) { out.className = "note err"; out.textContent = errText(e); el.disabled = false; } };
  document.querySelectorAll("[data-ra]").forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.id, days = parseInt(document.getElementById("ad-" + id).value, 10);
    busy(b, document.getElementById("admMsg"), () => api("POST", `/admin/access/${id}`, { action: b.dataset.ra, note: document.getElementById("an-" + id).value, ...(days > 0 ? { days } : {}) }));
  }));
  document.querySelectorAll("[data-ua]").forEach((b) => b.addEventListener("click", () => busy(b, document.getElementById("admUMsg"), () => api("POST", `/admin/users/${b.dataset.uid}/access`, { action: b.dataset.ua }))));
  const readPlans = () => [...document.querySelectorAll("#asPlans .adm-plan")].map((fs) => Object.fromEntries([...fs.querySelectorAll("[data-k]")].map((i) => [i.dataset.k, i.value])));
  document.getElementById("asAdd").addEventListener("click", () => { set.plans = [...readPlans(), { id: "plan-" + (set.plans.length + 1), name: "", price: "", description: "" }]; document.getElementById("asPlans").innerHTML = set.plans.map(planRow).join(""); bindRm(); });
  const bindRm = () => document.querySelectorAll("[data-rmplan]").forEach((b) => b.addEventListener("click", () => { const pl = readPlans(); pl.splice(+b.dataset.rmplan, 1); set.plans = pl; document.getElementById("asPlans").innerHTML = set.plans.map(planRow).join(""); bindRm(); }));
  bindRm();
  document.getElementById("admSet").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const days = parseInt(document.getElementById("asDays").value, 10), free = parseInt(document.getElementById("asFree").value, 10);
    const btn = ev.target.querySelector("button[type=submit]");
    busy(btn, document.getElementById("asMsg"), () => api("PUT", "/admin/settings", { subscription: { freeIdeaRuns: free >= 0 ? free : 1, accessDays: days > 0 ? days : null, plans: readPlans(), paymentInstructions: document.getElementById("asPay").value } }));
  });
  if (ST.admNote) { const m = document.getElementById("admMsg"); m.className = "note ok"; m.textContent = ST.admNote; ST.admNote = null; }
  if (focus) { const r = document.getElementById("ar-" + focus); if (r) r.scrollIntoView({ block: "center" }); }
}

// AI usage today (UTC day): each provider against the daily budget the site enforces, assistant and workspace use.
function usageHTML(u) {
  if (!u) return `<section class="oi-card"><h2>${esc(T("auTitle"))}</h2><p class="note err">${esc(T("errors.server_error"))}</p></section>`;
  const n = (x) => Math.round(x || 0).toLocaleString(L() === "sr" ? "sr-Latn-RS" : "en-GB");
  const bar = (used, budget) => { const p = budget ? Math.min(100, Math.round((100 * used) / budget)) : 0; return `<div class="au-bar" role="img" aria-label="${p}%"><span class="${p >= 90 ? "hi" : p >= 60 ? "mid" : "lo"}" style="width:${p}%"></span></div><span class="fine num">${p}%</span>`; };
  const reset = new Intl.DateTimeFormat(L() === "sr" ? "sr-Latn-RS" : "en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Belgrade" }).format(new Date(u.resetAt));
  return `<section class="oi-card au"><div class="oi-row au-head"><h2>${esc(T("auTitle"))}</h2><button type="button" class="btn ghost" id="auRefresh">${esc(T("auRefresh"))}</button></div>
    <p class="fine">${esc(T("auLede", u.day, reset, Math.round(u.workspaceShare * 100)))}</p>
    <div class="au-stats"><div><b>${n(u.assistant.messages)}</b><span class="fine">${esc(T("auMsgs", u.assistant.visitors, u.visitorLimit))}</span></div>
      <div><b>${n(u.workspace.actions)}</b><span class="fine">${esc(T("auActions", u.workspace.users.length, u.perUserLimit))}</span></div>
      <div><b>${n(u.providers.reduce((s, p) => s + p.requests, 0))}</b><span class="fine">${esc(T("auRequests"))}</span></div></div>
    <div class="tscroll"><table class="oi-t au-t"><thead><tr><th>${esc(T("auProvider"))}</th><th class="num">${esc(T("auUsed"))}</th><th class="num">${esc(T("auBudget"))}</th><th>${esc(T("auOfBudget"))}</th><th class="num">${esc(T("auReq"))}</th></tr></thead><tbody>
      ${u.providers.map((p) => `<tr><td>${esc(p.key === "workers-ai" ? "Workers AI" : p.key.startsWith("cerebras:") ? "Cerebras" : "Groq")}<div class="fine">${esc(p.name)}${p.configured ? "" : " · " + esc(T("auOff"))}</div></td><td class="num">${n(p.used)} <span class="fine">${esc(p.unit === "neurons" ? T("auNeurons") : T("auTokens"))}</span></td><td class="num">${n(p.budget)}${p.free ? `<div class="fine">${esc(T("auFree", n(p.free)))}</div>` : ""}</td><td><div class="au-p">${bar(p.used, p.budget)}</div></td><td class="num">${n(p.requests)}</td></tr>`).join("")}
    </tbody></table></div>
    ${(u.cached || []).length ? `<p class="fine">${esc(T("auCached", u.cached.reduce((s, c) => s + c.requests, 0), n(u.cached.reduce((s, c) => s + c.tokens, 0))))}</p>` : ""}
    ${(u.agents || []).length ? `<details open><summary>${esc(T("auAgents"))}</summary><p class="fine">${esc(T("auAgentsNote"))}</p><div class="tscroll"><table class="oi-t"><thead><tr><th>${esc(T("auFn"))}</th><th class="num">${esc(T("auNeurons"))}</th><th class="num">${esc(T("auTokens"))}</th><th class="num">${esc(T("auReq"))}</th></tr></thead><tbody>${u.agents.map((a) => `<tr><td>${esc(T("auAg." + a.key) || a.key)}</td><td class="num">${n(a.neurons)}</td><td class="num">${n(a.tokens)}</td><td class="num">${n(a.requests)}</td></tr>`).join("")}</tbody></table></div></details>` : ""}
    ${u.workspace.users.length ? `<details><summary>${esc(T("auUsers"))}</summary><table class="oi-t"><tbody>${u.workspace.users.map((x) => `<tr><td>${esc(x.email)}</td><td class="num">${x.count} / ${u.perUserLimit}</td></tr>`).join("")}</tbody></table></details>` : ""}
    <details><summary>${esc(T("auWeek"))}</summary><div class="tscroll"><table class="oi-t"><thead><tr><th>${esc(T("auDay"))}</th><th class="num">${esc(T("auReq"))}</th><th class="num">Workers AI (${esc(T("auNeurons"))})</th><th class="num">Groq (${esc(T("auTokens"))})</th><th class="num">${esc(T("auCacheCol"))}</th></tr></thead><tbody>
      ${u.days.map((x) => `<tr><td>${esc(x.day)}</td><td class="num">${n(x.requests)}</td><td class="num">${n(x.neurons)}</td><td class="num">${n(x.groqTokens)}</td><td class="num">${n(x.cached)}</td></tr>`).join("")}</tbody></table></div></details></section>`;
}

/* ---------- sign-in ---------- */
const GLOGO = '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-9.9 6.9-17.2z"/><path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.2-8.5 2.2-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z"/></svg>';
function renderLogin(err, signin) {
  const sg = signin || { google: true, email: false };
  app().innerHTML = `<div class="wrap"><div class="auth">
    <span class="eyebrow">${esc(T("title"))}</span><h1>${esc(T("signinTitle"))}</h1><p>${esc(T("signinLede"))}</p>
    <label class="chk"><input type="checkbox" id="oiAccept"> <span>${T("accept", "#about")}</span></label>
    <label class="chk"><input type="checkbox" id="oiNews"> <span>${esc(T("news"))}</span></label>
    ${sg.google ? `<div><button class="btn big gbtn" type="button" id="oiGoogle">${GLOGO} ${esc(T("google"))}</button></div>` : ""}
    <div id="oiMsg" role="status">${err && err !== "signin" ? `<p class="note err">${esc(errText({ message: err }))}</p>` : !sg.google && !sg.email ? `<p class="note err">${esc(T("errors.google_off"))}</p>` : ""}</div>
    ${sg.email ? `<form id="oiLogin" novalidate style="display:grid;gap:12px"><h2 style="font-size:16px">${esc(T("orEmail"))}</h2>
      <div class="fld"><label for="oiEmail">${esc(T("email"))}</label><input type="email" id="oiEmail" autocomplete="email" required></div>
      <div id="oiTs"></div><div><button class="btn quiet" type="submit">${esc(T("sendLink"))}</button></div></form>` : ""}
  </div></div>`;
  const msg = document.getElementById("oiMsg");
  app().querySelectorAll('a[href="#about"]').forEach((a) => a.addEventListener("click", () => { try { sessionStorage.setItem("ec-scroll-accounts", "1"); } catch {} }));
  const g = document.getElementById("oiGoogle");
  if (g) g.addEventListener("click", () => {
    if (!document.getElementById("oiAccept").checked) { msg.innerHTML = `<p class="note err">${esc(T("acceptFirst"))}</p>`; return; }
    const q = new URLSearchParams({ accept: "1", news: document.getElementById("oiNews").checked ? "1" : "0", lang: L() });
    location.href = "/api/auth/google?" + q;
  });
  const form = document.getElementById("oiLogin");
  if (!form) return;
  const tsReady = EC.turnstileInto(document.getElementById("oiTs"));
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; msg.innerHTML = "";
    try {
      const token = await (await tsReady)();
      const r = await api("POST", "/auth/request", { email: document.getElementById("oiEmail").value, accept: document.getElementById("oiAccept").checked, news: document.getElementById("oiNews").checked, lang: L(), turnstile: token });
      msg.innerHTML = `<p class="note ok">${esc(T("linkSent"))}</p>` + (r.devLink ? `<p class="note">${esc(T("devLink"))} <a class="devlink" href="${esc(r.devLink)}">${esc(r.devLink)}</a></p>` : "");
    } catch (e) { msg.innerHTML = `<p class="note err">${esc(errText(e))}</p>`; }
    btn.disabled = false;
  });
}
function renderSignin(token) {
  history.replaceState(null, "", location.pathname + location.search + "#org"); // the token leaves the address bar
  app().innerHTML = `<div class="wrap"><div class="auth"><h1>${esc(T("continueTitle"))}</h1><div><button class="btn big" id="oiCont">${esc(T("continueBtn"))}</button></div><div id="oiMsg" role="status"></div></div></div>`;
  document.getElementById("oiCont").addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    try { await api("POST", "/auth/verify", { token }); ST.me = undefined; go("org"); }
    catch (e) { document.getElementById("oiMsg").innerHTML = `<p class="note err">${esc(e.message === "link_invalid" ? T("linkInvalid") : errText(e))}</p><p><a href="#org">${esc(T("sendLink"))}</a></p>`; }
  });
}
// Sign out, and account deletion in two steps (the first click asks for confirmation).
function bindAccount() {
  const out = document.getElementById("oiOut");
  if (out && !out.dataset.bound) out.dataset.bound = "1", out.addEventListener("click", async () => { await api("POST", "/auth/logout").catch(() => {}); ST.me = undefined; ST.org = null; go("org"); });
  const del = document.getElementById("oiDelMe"), msg = document.getElementById("oiAccMsg");
  if (!del || !msg || del.dataset.bound) return;
  del.dataset.bound = "1";
  del.addEventListener("click", () => {
    msg.innerHTML = `<p class="note warn">${esc(T("deleteAccountNote"))}</p><div class="oi-row"><button type="button" class="btn" id="oiDelYes">${esc(T("deleteAccountConfirm"))}</button><button type="button" class="btn ghost" id="oiDelNo">${esc(T("cancel"))}</button></div>`;
    document.getElementById("oiDelNo").addEventListener("click", () => { msg.innerHTML = ""; });
    document.getElementById("oiDelYes").addEventListener("click", async () => {
      try { await api("DELETE", "/me"); ST.me = undefined; ST.org = null; go("org"); }
      catch (e) { msg.innerHTML = `<p class="note err">${esc(errText(e))}</p>`; }
    });
  });
}
function renderCreate() {
  app().innerHTML = `<div class="wrap"><form class="auth" id="oiCreate"><span class="eyebrow">${esc(T("title"))}</span><h1>${esc(T("createTitle"))}</h1><p>${esc(T("createLede"))}</p>
    <div class="fld"><label for="oiName">${esc(T("orgName"))}</label><input type="text" id="oiName" maxlength="200" required></div>
    <div><button class="btn" type="submit">${esc(T("create"))}</button></div><div id="oiMsg" role="status"></div>
    ${ST.me && ST.me.user ? `<p class="fine">${esc(T("signedInAs", ST.me.user.email))} · <button type="button" class="linkbtn" id="oiOut">${esc(T("signOut"))}</button>${ST.me.orgs.length ? "" : ` · <button type="button" class="linkbtn" id="oiDelMe">${esc(T("deleteAccount"))}</button>`}</p><div id="oiAccMsg" role="status"></div>` : ""}</form></div>`;
  bindAccount();
  document.getElementById("oiCreate").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    try { const r = await api("POST", "/orgs", { name: document.getElementById("oiName").value }); ST.me = undefined; go("org/" + r.id + "/profile"); }
    catch (e) { document.getElementById("oiMsg").innerHTML = `<p class="note err">${esc(errText(e))}</p>`; }
  });
}

/* ---------- overview ---------- */
const statusBadge = (s) => `<span class="st ${s}">${esc(T("statusL." + s))}</span>`;
const meter = (pct, cls = "") => `<div class="meter ${cls}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
// Compatibility scores everywhere use the same three colours (scoreTier); status badges use the mandatory checks.
const tierCls = (score) => "t-" + scoreTier(score);
const scoreMeter = (score) => meter(score, tierCls(score));
const scoreNum = (score) => `<b class="scn ${tierCls(score)}">${score}%</b>`;
// Overview: the organisation's position at a glance. The statistics are shortcuts: each one opens the
// eligibility matching list with the filter it counts, the profile's missing fields or the saved ideas.
async function secOverview(arg) {
  const org = ST.org, p = org.profile, c = completeness(p), id = org.id;
  let savedIdeas = 0; try { savedIdeas = (await api("GET", `/orgs/${id}/ideas`)).ideas.filter((x) => x.status === "saved").length; } catch { /* shown as 0 */ }
  const res = results();
  let savedReports = 0; try { savedReports = (await api("GET", `/orgs/${id}/reports`)).reports.length; } catch { /* shown as 0 */ }
  const ok = res.filter((r) => r.status === "eligible" || r.status === "potential");
  const high = res.filter((r) => r.score >= HIGH);
  const soon = ok.filter((r) => r.score >= 60).map((r) => ({ r, dl: EC.nextDl(r.call) })).filter((x) => x.dl).sort((a, b) => a.dl.localeCompare(b.dl)).slice(0, 6);
  const strengths = [];
  if (p.activityAreas && p.activityAreas.length) strengths.push(`${T("dims.objectives")}: ${listOf(p.activityAreas, sectorName)}`);
  if (p.targetGroups && p.targetGroups.length) strengths.push(`${T("dims.targetGroups")}: ${listOf(p.targetGroups, groupName)}`);
  for (const k of ["euFunding", "erasmus"]) if (p[k] === "coordinator" || p[k] === "both") { strengths.push(nm(FIELD[k]) + ": " + nm(EXPERIENCE.find((x) => x.id === p[k]))); break; }
  if (p.partnerCountries && p.partnerCountries.length) strengths.push(`${nm(FIELD.partnerCountries)}: ${listOf(p.partnerCountries, ccName)}`);
  const stat = (href, label, v, extra = "", hint = "") => `<a class="stat go" href="${href}"><span class="l">${esc(label)}</span><span class="v">${v}</span>${extra}<span class="hint">${esc(hint)} →</span></a>`;
  return `<h1>${esc(org.name)}</h1>
    ${!p.country || !p.orgType ? `<p class="note warn">${esc(T("noCountry"))} <a href="#org/${id}/profile/missing">${esc(T("fillProfile"))}</a></p>` : ""}
    <div class="oi-grid">
      ${stat(`#org/${id}/profile/missing`, T("complete"), c.pct + "%", meter(c.pct), c.missing.length ? T("goComplete") : T("goProfile"))}
      ${stat(`#org/${id}/matching/all`, T("analysed"), res.length, "", T("goList"))}
      ${stat(`#org/${id}/matching/high`, T("high"), high.length, "", T("goList"))}
      ${stat(`#org/${id}/matching/eligible`, T("eligibleN"), res.filter((r) => r.status === "eligible").length, "", T("goList"))}
      ${stat(`#org/${id}/ideas/saved`, T("savedIdeasN"), savedIdeas, "", T("goIdeas"))}
      ${stat(`#org/${id}/reports`, T("savedReportsN"), savedReports, "", T("goReports"))}
    </div>
    <div class="oi-card"><h2>${esc(T("upcoming"))}</h2>${soon.length ? `<div class="tw"><table class="oi-t upc"><tbody>${soon.map(({ r, dl }) => `<tr><td class="num">${esc(EC.fmtDate(dl))}</td><td><a href="#org/${id}/match/${encodeURIComponent(r.call.key)}">${esc(r.call.title)}</a><div class="fine">${esc((EC.P[r.call.programme] || {}).short || r.call.programmeName || "")}</div></td><td class="num">${scoreNum(r.score)}</td><td>${statusBadge(r.status)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="fine">${esc(T("none"))}</p>`}</div>
    <div class="oi-cols mt">
      <div class="oi-card"><h2>${esc(T("missingTitle"))}</h2>${c.missing.length ? `<p>${esc(listOf(c.missing.slice(0, 12), fieldName))}</p><p><a href="#org/${id}/profile/missing">${esc(T("fillProfile"))} →</a></p>` : `<p class="fine">${esc(T("missingNone"))}</p>`}
        <h2 class="mt">${esc(T("strengthsTitle"))}</h2>${strengths.length ? `<ul>${strengths.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="fine">${esc(T("none"))}</p>`}</div>
    </div>
    <p><a class="btn quiet" href="#org/${id}/matching/all">${esc(T("openMatching"))} →</a></p>
    ${org.updatedAt ? `<p class="fine">${esc(T("lastUpdate", fmtTime(org.updatedAt), org.version))}</p>` : ""}`;
}
// Eligibility matching: every analysed call with its eligibility status and score. The argument sets a filter
// (from the overview statistics): all, high (70%+), eligible.
function secMatching(arg) {
  const F = ST.filters;
  if (arg === "all") Object.assign(F, { status: "", high: false, prog: "", dl: "", shown: 30 });
  if (arg === "high") Object.assign(F, { status: "", high: true, prog: "", dl: "", shown: 30 });
  if (arg === "eligible") Object.assign(F, { status: "eligible", high: false, prog: "", dl: "", shown: 30 });
  // A preset from the overview is applied once: the address goes back to the plain tab, so unticking a filter
  // re-renders without the preset being applied again.
  if (arg) try { history.replaceState(null, "", location.pathname + location.search + `#org/${ST.org.id}/matching`); } catch { /* keeps working, the preset stays in the address */ }
  return `<section id="oiMatches" class="matches">${matchingHTML()}</section>`;
}
afterRender.matching = () => bindMatching();

/* ---------- profile ---------- */
const GROUPS = { identity: ["name", "orgType", "country", "city", "registrationNumber", "oid", "yearEstablished", "website"], about: ["description", "mission", "objectives", "activityAreas", "targetGroups", "geoScope"],
  experience: ["previousProjects", "euFunding", "erasmus", "fundingDetails", "eche"], capacity: ["employees", "volunteers", "infrastructure", "capacity", "expertise"], partners: ["partnerCountries", "partnerships"] };
function provBadge(m) {
  if (!m) return "";
  const cls = m.source === "manual" ? "" : m.source === "document" ? "doc" : "web";
  const src = m.sourceName || m.sourceUrl || "";
  return `<span class="prov ${cls}" title="${esc((m.evidence ? "“" + m.evidence + "” " : "") + src)}">${esc(T("prov." + m.source))}${src && m.source !== "manual" ? ": " + esc(src.slice(0, 40)) : ""}</span>${m.verified ? "" : `<span class="prov unver">${esc(T("unverified"))}</span>`}`;
}
function input(f, v, dis) {
  const id = "f_" + f.id, d = dis ? " disabled" : "";
  const opts = (list, multi) => list.map((o) => `<label><input type="${multi ? "checkbox" : "radio"}" name="${id}" value="${o.id}"${(multi ? (v || []).includes(o.id) : v === o.id) ? " checked" : ""}${d}>${esc(nm(o))}</label>`).join("");
  switch (f.kind) {
    case "long": return `<textarea id="${id}" maxlength="${f.max}"${d}>${esc(v || "")}</textarea>`;
    case "int": case "year": return `<input type="number" id="${id}" ${f.kind === "year" ? 'min="1800" max="' + new Date().getFullYear() + '"' : 'min="0"'} value="${v ?? ""}"${d}>`;
    case "url": return `<input type="url" id="${id}" value="${esc(v || "")}" placeholder="https://"${d}>`;
    case "bool": return `<select id="${id}"${d}><option value="">${esc(T("unknown"))}</option><option value="true"${v === true ? " selected" : ""}>${esc(T("yes"))}</option><option value="false"${v === false ? " selected" : ""}>${esc(T("no"))}</option></select>`;
    case "enum": return `<select id="${id}"${d}><option value=""></option>${f.options.map((o) => `<option value="${o.id}"${v === o.id ? " selected" : ""}>${esc(nm(o))}</option>`).join("")}</select>`;
    case "country": return `<select id="${id}"${d}><option value=""></option>${EC.TAX.countries.map((c) => `<option value="${c.id}"${v === c.id ? " selected" : ""}>${esc(nm(c))}</option>`).join("")}</select>`;
    case "multi": return `<div class="chips" id="${id}">${opts(f.source === "sectors" ? EC.TAX.sectors : f.options, true)}</div>`;
    case "countries": return `<div class="chips" id="${id}">${opts(EC.TAX.countries, true)}</div>`;
    default: return `<input type="text" id="${id}" maxlength="${f.max}" value="${esc(v || "")}"${d}>`;
  }
}
function readField(f) {
  const id = "f_" + f.id, el = document.getElementById(id);
  if (!el) return undefined;
  if (f.kind === "multi" || f.kind === "countries") return [...el.querySelectorAll("input:checked")].map((x) => x.value);
  if (f.kind === "int" || f.kind === "year") return el.value === "" ? null : +el.value;
  if (f.kind === "bool") return el.value === "" ? null : el.value === "true";
  return el.value.trim() || null;
}
function secProfile(arg) {
  const org = ST.org, p = org.profile, meta = p._meta || {}, dis = !canEdit();
  const wide = new Set(["long", "multi", "countries"]);
  const miss = completeness(p).missing;
  return `<h1>${esc(T("nav.profile"))}</h1>${dis ? `<p class="note">${esc(T("viewerNote"))}</p>` : ""}
    ${arg === "missing" && miss.length && !dis ? `<p class="note warn">${esc(T("missingHere", miss.length))} <a href="#org/${org.id}/documents">${esc(T("orFromDocs"))} →</a></p>` : ""}
    <form class="form" id="oiProfile" novalidate>${Object.entries(GROUPS).map(([g, ids]) => `<fieldset><legend>${esc(T("sections." + g))}</legend>${ids.map((fid) => { const f = FIELD[fid]; return `<div class="fld${wide.has(f.kind) ? " wide" : ""}" data-f="${fid}"><${f.kind === "multi" || f.kind === "countries" ? "span class=\"lbl\"" : `label for="f_${fid}"`}>${esc(nm(f))} ${provBadge(meta[fid])}</${f.kind === "multi" || f.kind === "countries" ? "span" : "label"}>${input(f, p[fid], dis)}<span class="err" hidden></span></div>`; }).join("")}</fieldset>`).join("")}
    ${dis ? "" : `<div class="savebar"><button class="btn" type="submit">${esc(T("save"))}</button><span id="oiSaveMsg" class="fine" role="status"></span></div>`}</form>
    ${trHTML()}`;
}
// English copy of the free-text fields that are not in English (src/org/translate.js): shown and editable here.
function trHTML() {
  const org = ST.org, tr = org.translation, p = org.profile, dis = !canEdit();
  if (!tr) return `<section class="oi-card tr" id="oiTr" hidden></section>`;
  const show = TEXT_FIELDS.filter((f) => p[f] && ((tr.langs || {})[f] === "sr" || (tr.langs || {})[f] === "other" || tr.fields[f]));
  if (!show.length) return `<section class="oi-card tr" id="oiTr" hidden></section>`;
  const rows = show.map((f) => {
    const x = tr.fields[f], used = tr.textEn && tr.textEn[f];
    const state = !x ? T("trNone") : x.edited ? T("trEdited", fmtTime(x.at)) : T("trMachine", x.model ? String(x.model).split("/").pop() : "", fmtTime(x.at));
    const warn = x && x.stale ? `<p class="note warn">${esc(T(x.edited ? "trStaleEdited" : "trStaleAuto"))}</p>` : "";
    return `<div class="tr-f" data-trf="${f}"><h3>${esc(nm(FIELD[f]))}</h3>
      <details class="tr-orig"><summary>${esc(T("trOrig"))}</summary><p>${esc(p[f])}</p></details>
      <p class="fine">${esc(state)}${used ? ` · <b>${esc(T("trUse"))}</b>` : ""}</p>${warn}
      <div class="fld"><label class="sr-only" for="tr_${f}">${esc(nm(FIELD[f]))} (EN)</label><textarea id="tr_${f}" rows="4" lang="en"${dis ? " disabled" : ""}>${esc(x ? x.text : "")}</textarea></div>
      ${dis ? "" : `<div class="oi-row"><button type="button" class="btn quiet" data-trsave="${f}">${esc(T("trSave"))}</button><span class="fine" data-trmsg role="status"></span></div>`}</div>`;
  }).join("");
  return `<section class="oi-card tr" id="oiTr"><h2>${esc(T("trT"))}</h2><p class="fine">${esc(T("trLede"))}</p>
    ${!dis && tr.pending && tr.pending.length ? `<div class="oi-row"><button type="button" class="btn" id="trRun">${esc(T("trRun"))}</button></div>` : ""}<div class="op" id="oiTrMsg" role="status" aria-live="polite"></div>
    ${rows}</section>`;
}
function bindTr() {
  const box = document.getElementById("oiTr"); if (!box || box.hidden) return;
  const org = ST.org;
  const run = document.getElementById("trRun");
  if (run) run.addEventListener("click", () => ensureEnglish(document.getElementById("oiTrMsg"), true));
  box.querySelectorAll("[data-trsave]").forEach((b) => b.addEventListener("click", async () => {
    const f = b.dataset.trsave, m = b.parentElement.querySelector("[data-trmsg]"), text = document.getElementById("tr_" + f).value;
    b.disabled = true;
    try {
      ST.org.translation = await api("PUT", `/orgs/${org.id}/translation`, { field: f, text });
      redrawTr(); const nm2 = document.querySelector(`[data-trf="${f}"] [data-trmsg]`); if (nm2) { nm2.className = "fine ok"; nm2.textContent = T(text.trim() ? "trSaved" : "trCleared"); }
    } catch (e) { b.disabled = false; if (m) { m.className = "fine err"; m.textContent = errText(e); } }
  }));
}
function redrawTr() { const box = document.getElementById("oiTr"); if (!box) return; const d = document.createElement("div"); d.innerHTML = trHTML(); box.replaceWith(d.firstElementChild); bindTr(); }
// Makes the English copy of fields that need one: once after each save, or when the user asks. The profile is
// already saved; a failure only means matching keeps using the original text.
async function ensureEnglish(el, force) {
  const org = ST.org, tr = org && org.translation;
  if (!org || !tr || !canEdit() || (!force && !(tr.pending && tr.pending.length))) return;
  const run = document.getElementById("trRun"); if (run) run.disabled = true;
  opState(el, "translating");
  try {
    const r = await api("POST", `/orgs/${org.id}/translation`, {});
    if (ST.org && ST.org.id === org.id) { const { translated, model, ...view } = r; ST.org.translation = view; ST.resultsKey = null; }
    redrawTr();
    // the copy section may have been drawn again: write to the status element on the page now
    opState(document.getElementById("oiTrMsg") || el, "completed", r.translated.length ? T("trDone", r.translated.length) : T("trNothing"));
  } catch (e) {
    opState(document.getElementById("oiTrMsg") || el, "failed", T("trFailed") + " " + errText(e));
    if (run) run.disabled = false;
  }
}
afterRender.profile = (arg) => {
  const form = document.getElementById("oiProfile"); if (!form) return;
  if (arg === "missing") {
    // Highlight what completeness counts as missing and take the user to the first one.
    const miss = completeness(ST.org.profile).missing;
    miss.forEach((k) => { const box = form.querySelector(`[data-f="${k}"]`); if (box) box.classList.add("need"); });
    const first = miss.length && form.querySelector(`[data-f="${miss[0]}"]`);
    if (first) { first.scrollIntoView({ block: "center" }); const inp = first.querySelector("input,select,textarea"); if (inp) inp.focus({ preventScroll: true }); }
  }
  bindTr();
  if (!canEdit()) return;
  const msg = document.getElementById("oiSaveMsg");
  // The form saves against the profile it was drawn from: if the profile changed meanwhile (another member, or a
  // document read in the background), the server answers version_conflict instead of overwriting the newer values.
  const drawn = ST.org;
  form.addEventListener("input", (ev) => { msg.textContent = T("unsaved"); const box = ev.target.closest(".need"); if (box) box.classList.remove("need"); });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const org = drawn, old = org.profile, meta = { ...(old._meta || {}) }, next = {};
    for (const f of FIELDS) {
      const v = readField(f);
      if (v !== null && v !== undefined && !(Array.isArray(v) && !v.length)) next[f.id] = v;
      // A value changed by hand is the user's own statement.
      if (JSON.stringify(v ?? null) !== JSON.stringify(old[f.id] ?? null)) { if (next[f.id] !== undefined) meta[f.id] = { source: "manual", verified: true, at: new Date().toISOString() }; else delete meta[f.id]; }
    }
    for (const k of Object.keys(meta)) if (next[k] === undefined) delete meta[k];
    if (Object.keys(meta).length) next._meta = meta;
    form.querySelectorAll(".err").forEach((e) => (e.hidden = true));
    try {
      const r = await api("PUT", `/orgs/${org.id}/profile`, { profile: next, baseVersion: org.version });
      await loadOrg(org.id, true); ST.me = undefined; await loadMe();
      msg.textContent = T("saved", r.version);
      redrawTr(); ensureEnglish(document.getElementById("oiTrMsg"));
    } catch (e) {
      if (e.message === "invalid" && e.data && e.data.fields) {
        for (const [k, code] of Object.entries(e.data.fields)) { const box = form.querySelector(`[data-f="${k}"] .err`); if (box) { box.hidden = false; box.textContent = code; } }
        msg.textContent = T("invalid");
      } else if (e.message === "version_conflict") msg.innerHTML = `${esc(T("conflict"))} <a href="#org/${org.id}/profile" id="oiReload">${esc(T("reload"))}</a>`;
      else msg.textContent = errText(e);
      const rl = document.getElementById("oiReload"); if (rl) rl.addEventListener("click", async (x) => { x.preventDefault(); await loadOrg(org.id, true); refresh(); });
    }
  });
};

/* ---------- documents and web research ---------- */
// Text is read in the browser. Pages without a text layer (scans), TIFF files and photos go through OCR
// (Tesseract, Serbian Cyrillic + Serbian Latin + English), also in the browser; the file is never uploaded.
// One part of a document is one model request. It must fit the smallest per-minute limit of the provider chain
// (Groq free plan: 8,000 tokens with the answer) together with the instructions (about 1,200 tokens) and the
// answer (1,500): parts are cut by estimated tokens, so Cyrillic text gets shorter parts than English.
const CHUNK = 14000, MAX_PARTS = 6, PART_TOKENS = 4200;
const TESS = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
const PAKO = "https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js";
const UTIF_JS = "https://cdn.jsdelivr.net/npm/utif@3.1.0/UTIF.js";
const OCR_LANGS = "srp+srp_latn+eng", OCR_MAX_PAGES = 30;
const IMG_EXT = ["jpg", "jpeg", "png", "webp", "bmp", "gif"], TIF_EXT = ["tif", "tiff"];
const ACCEPT = ".pdf,.docx,.txt,.md,.tif,.tiff,.jpg,.jpeg,.png,.webp,.bmp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/tiff,image/jpeg,image/png,image/webp";
let OCR = null, OCR_LOG = null;
function ocrWorker() {
  if (!OCR) OCR = EC.loadScript(TESS).then(() => window.Tesseract.createWorker(OCR_LANGS, 1, { logger: (m) => OCR_LOG && OCR_LOG(m) }))
    .catch((e) => { OCR = null; throw new Error("ocr_unavailable"); });
  return OCR;
}
async function ocr(image, label, say) {
  const w = await ocrWorker();
  OCR_LOG = (m) => { if (m.status === "recognizing text") say(label, "ocr", 100 * (m.progress || 0)); else if (/load|initiali/.test(m.status || "")) say(T("ocrLoading"), "ocr"); };
  const r = await w.recognize(image);
  OCR_LOG = null;
  return { text: r.data.text || "", conf: r.data.confidence || 0 };
}
// Returns {text, ocrPages, pages, lowConf}.
async function readDocument(file, say) {
  const ext = file.name.split(".").pop().toLowerCase();
  const out = { text: "", ocrPages: 0, pages: 0, lowConf: 0 };
  const addOcr = (r) => { out.text += r.text + "\n\n"; out.ocrPages++; if (r.conf < 55) out.lowConf++; };
  if (ext === "pdf" || file.type === "application/pdf") {
    await EC.loadScript(EC.PDFJS_WORKER); await EC.loadScript(EC.PDFJS);
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    out.pages = pdf.numPages;
    for (let i = 1; i <= pdf.numPages && out.text.length < CHUNK * MAX_PARTS; i++) {
      say(T("readingPage", i, pdf.numPages), "reading", (100 * (i - 1)) / pdf.numPages);
      const pg = await pdf.getPage(i);
      const t = (await pg.getTextContent()).items.map((x) => x.str).join(" ");
      if (t.replace(/\s/g, "").length >= 40) { out.text += t + "\n\n"; continue; }
      if (out.ocrPages >= OCR_MAX_PAGES) continue;
      // No text layer: draw the page at about 200 dpi and recognise it.
      const vp = pg.getViewport({ scale: 2.8 });
      const cv = document.createElement("canvas"); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
      await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      addOcr(await ocr(cv, T("ocrPage", i, pdf.numPages), say));
    }
    return out;
  }
  if (TIF_EXT.includes(ext) || file.type === "image/tiff") {
    await EC.loadScript(PAKO); await EC.loadScript(UTIF_JS);
    const buf = await file.arrayBuffer(), ifds = window.UTIF.decode(buf);
    out.pages = ifds.length;
    for (let i = 0; i < ifds.length && i < OCR_MAX_PAGES; i++) {
      window.UTIF.decodeImage(buf, ifds[i], ifds);
      const w = ifds[i].width, h = ifds[i].height; if (!w || !h) continue;
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d"), img = ctx.createImageData(w, h); img.data.set(window.UTIF.toRGBA8(ifds[i])); ctx.putImageData(img, 0, 0);
      addOcr(await ocr(cv, T("ocrPage", i + 1, ifds.length), say));
    }
    return out;
  }
  if (IMG_EXT.includes(ext) || file.type.startsWith("image/")) { out.pages = 1; addOcr(await ocr(file, T("ocrPage", 1, 1), say)); return out; }
  if (ext === "docx") { await EC.loadScript(EC.MAMMOTH); out.text = (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value; return out; }
  if (["txt", "md"].includes(ext) || file.type.startsWith("text/")) { out.text = await file.text(); return out; }
  throw new Error("type");
}
function splitText(text) {
  const parts = []; let i = 0;
  while (i < text.length && parts.length < MAX_PARTS) {
    let end = Math.min(text.length, i + CHUNK);
    for (let k = 0, est; k < 8 && (est = estTokens(text.slice(i, end))) > PART_TOKENS; k++) end = i + Math.floor(((end - i) * PART_TOKENS) / est * 0.97);
    const len = end - i;
    if (end < text.length) { const cut = text.lastIndexOf("\n", end); if (cut > i + len * 0.6) end = cut; }
    parts.push(text.slice(i, end)); i = end;
  }
  parts.covered = i;   // characters sent; the rest of a very long document is not analysed
  return parts;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function valueText(f, v) {
  if (v === undefined || v === null || v === "") return "";
  if (f.kind === "enum") return nm(f.options.find((o) => o.id === v)) || v;
  if (f.kind === "multi") return listOf(v, f.source === "sectors" ? sectorName : groupName);
  if (f.kind === "countries") return listOf(v, ccName);
  if (f.kind === "country") return ccName(v);
  if (f.kind === "bool") return v ? T("yes") : T("no");
  return String(v);
}
// List fields (areas, target groups, partner countries) are merged with what the profile has; other fields replace it.
const isList = (k) => ["multi", "countries"].includes(FIELD[k].kind);
const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const whyText = (w) => T("why." + w) || w;
// What the automatic fill did with one source: written fields, conflicts to decide, values left out.
function fillHTML(run) {
  const r = run.result, id = ST.org.id, ed = canEdit();
  if (!r) return `<div class="oi-card"><h2>${esc(run.sourceName)}</h2><p class="fine">${esc(T("notFilledYet"))}</p>${ed ? `<button class="btn" type="button" data-fill="${run.id}">${esc(T("fillNow"))}</button>` : ""}</div>`;
  const ev = (k) => (run.fields[k] || {});
  const quote = (k) => `<p class="quote">${esc(ev(k).evidence || "")}</p>${ev(k).sourceUrl ? `<a class="fine" href="${esc(ev(k).sourceUrl)}" target="_blank" rel="noopener">${esc(new URL(ev(k).sourceUrl).pathname)}</a>` : ""}`;
  return `<div class="oi-card fill" id="fill-${run.id}"><h2>${esc(T("filledFrom", run.sourceName))}</h2>
    <p class="note ok">${esc(T("filledN", r.filled.length))}${r.conflicts.length ? " " + esc(T("conflictsN", r.conflicts.length)) : ""}${r.notApplied.length ? " " + esc(T("notAppliedN", r.notApplied.length)) : ""}</p>
    ${r.filled.length ? `<div class="tw"><table class="oi-t"><thead><tr><th>${esc(T("field"))}</th><th>${esc(T("filledValue"))}</th><th>${esc(T("evidence"))}</th></tr></thead><tbody>
      ${r.filled.map((f) => `<tr><td>${esc(fieldName(f.id))}</td><td>${esc(valueText(FIELD[f.id], f.value))}${f.added ? ` <span class="fine">(${esc(T("addedToList"))})</span>` : ""}${f.replaced !== undefined ? `<div class="fine">${esc(T("replaced", valueText(FIELD[f.id], f.replaced)))}</div>` : ""}</td><td>${quote(f.id)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    ${r.conflicts.length ? `<h3>${esc(T("conflictsTitle"))}</h3><p class="fine">${esc(T("conflictsLede"))}</p><div class="tw"><table class="oi-t"><thead><tr><th>${esc(T("field"))}</th><th>${esc(T("current"))}</th><th>${esc(T("foundValue"))}</th><th></th></tr></thead><tbody>
      ${r.conflicts.map((c) => `<tr><td>${esc(fieldName(c.id))}</td><td>${esc(valueText(FIELD[c.id], c.current))}<div class="fine">${esc(T("prov." + (c.currentSource || "manual")))}</div></td><td>${esc(valueText(FIELD[c.id], c.proposed))}${quote(c.id)}</td>
        <td>${ed ? `<div class="oi-row"><button type="button" class="btn quiet" data-take="${c.id}" data-run="${run.id}">${esc(T("useFound"))}</button><button type="button" class="btn ghost" data-keep="${c.id}" data-run="${run.id}">${esc(T("keepCurrent"))}</button></div>` : ""}</td></tr>`).join("")}</tbody></table></div>` : ""}
    ${r.notApplied.length ? `<details class="crit-full"><summary>${esc(T("notAppliedTitle", r.notApplied.length))}</summary><div class="tw"><table class="oi-t"><tbody>
      ${r.notApplied.map((c) => `<tr><td>${esc(fieldName(c.id))}</td><td>${esc(valueText(FIELD[c.id], c.value))}<div class="fine">${esc(whyText(c.why))}</div></td><td>${quote(c.id)}</td><td>${ed ? `<button type="button" class="btn ghost" data-take="${c.id}" data-run="${run.id}">${esc(T("useAnyway"))}</button>` : ""}</td></tr>`).join("")}</tbody></table></div></details>` : ""}
    <p><a class="btn quiet" href="#org/${id}/profile">${esc(T("reviewProfile"))} →</a> <span class="fine">${esc(T("autoNote"))}</span></p>
    <div role="status" class="fill-msg"></div></div>`;
}
async function secDocuments() {
  const org = ST.org, dis = !canEdit();
  let runs = [];
  try { runs = (await api("GET", `/orgs/${org.id}/extractions`)).extractions; } catch { /* shown empty */ }
  ST.runs = runs;
  // A document read in the background for this organisation opens its values when the page is visited.
  if (JOB.cur && JOB.cur.done && JOB.cur.orgId === org.id && !JOB.cur.seen) { ST.openRun = JOB.cur.runId; JOB.cur.seen = true; }
  const open = ST.openRun && runs.find((r) => r.id === ST.openRun);
  return `<h1>${esc(T("docsTitle"))}</h1><p class="lede">${esc(T("docsLede"))}</p>${dis ? `<p class="note">${esc(T("viewerNote"))}</p>` : ""}
    ${dis ? "" : `<div class="drop"><label class="btn" for="oiFile">${esc(T("upload"))}</label><input type="file" id="oiFile" accept="${ACCEPT}" hidden><p class="fine">${esc(T("uploadFormats"))}</p><div class="op" id="oiProg" role="status" aria-live="polite"></div><div class="op" id="oiTrMsg" role="status" aria-live="polite"></div></div>
    <form class="oi-card" id="oiWeb"><h2>${esc(T("webTitle"))}</h2><p class="fine">${esc(T("webLede"))}</p><div class="fld"><label for="oiUrl">${esc(T("url"))}</label><input type="url" id="oiUrl" placeholder="https://" value="${esc(org.profile.website || "")}"></div><div><button class="btn" type="submit">${esc(T("readSite"))}</button></div><div class="op" id="oiWebMsg" role="status"></div></form>`}
    <div id="oiReview">${open ? fillHTML(open) : ""}</div>
    <div class="oi-card"><h2>${esc(T("runs"))}</h2>${runs.length ? `<table class="oi-t"><tbody>${runs.map((r) => `<tr><td>${esc(fmtTime(r.at))}</td><td>${esc(r.sourceName)}${r.sourceUrl ? ` <a class="fine" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">↗</a>` : ""}<div class="fine">${r.result ? esc(T("runSummary", r.result.filled.length, r.result.conflicts.length)) : Object.keys(r.fields).length + " · " + esc(T("status." + r.status))}</div></td><td><button type="button" class="btn ghost" data-open="${r.id}">${esc(T("open"))}</button>${dis ? "" : ` <button type="button" class="linkbtn" data-del="${r.id}">${esc(T("del"))}</button>`}</td></tr>`).join("")}</tbody></table>` : `<p class="fine">${esc(T("none"))}</p>`}</div>`;
}
/* ---------- document upload that keeps running across pages ---------- */
// One document at a time is read (OCR runs in this browser tab), analysed and applied to the organisation's profile
// while the member moves around the site. Its progress shows in a small box on every page and on the Documents page.
// Reloading or leaving the site stops it, so the browser asks first while it runs.
const JOB = { cur: null };
const docJobBusy = () => !!(JOB.cur && !JOB.cur.done && !JOB.cur.err);
const jobGuard = (ev) => { ev.preventDefault(); ev.returnValue = ""; };
function jobDraw() {
  const j = JOB.cur;
  let box = document.getElementById("ecJob");
  if (!box) { box = document.createElement("div"); box.id = "ecJob"; box.className = "ec-job"; box.setAttribute("role", "status"); box.setAttribute("aria-live", "polite"); box.hidden = true; document.body.appendChild(box); }
  const docs = j && location.hash === `#org/${j.orgId}/documents`;
  const prog = document.getElementById("oiProg"), lbl = document.querySelector('label[for="oiFile"]');
  if (lbl) lbl.classList.toggle("busy", docJobBusy());
  if (j && prog && ST.org && ST.org.id === j.orgId) opState(prog, j.state, j.text, j.pct);
  if (!j || docs) { box.hidden = true; return; }   // the Documents page shows the job in its own status line
  box.hidden = false;
  box.innerHTML = `<div class="ec-job-h"><b>${esc(j.name)}</b><span class="fine">${esc(j.orgName)}</span>${j.done || j.err ? `<button type="button" class="linkbtn ec-job-x" data-jx aria-label="${esc(T("jobClose"))}">×</button>` : ""}</div>
    <div class="op" data-jop></div>${j.done || j.err ? `<a href="#org/${esc(j.orgId)}/documents">${esc(T(j.done ? "jobOpen" : "jobDocs"))} →</a>` : ""}`;
  opState(box.querySelector("[data-jop]"), j.state, j.text, j.pct);
  const x = box.querySelector("[data-jx]"); if (x) x.addEventListener("click", () => { JOB.cur = null; jobDraw(); });
}
window.addEventListener("hashchange", () => setTimeout(jobDraw, 0));
async function runDocJob(f) {
  const org = ST.org, orgId = org.id;
  const j = JOB.cur = { orgId, orgName: (org.profile && org.profile.name) || org.name || "", name: f.name, state: "reading", text: f.name, pct: null };
  const say = (t, st = "reading", pct = null) => { Object.assign(j, { text: t, state: st, pct }); if (JOB.cur === j) jobDraw(); };
  window.addEventListener("beforeunload", jobGuard);
  say(f.name, "reading");
  try {
    const doc = await readDocument(f, say);
    const text = doc.text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    if (text.replace(/\s/g, "").length < 80) { j.err = true; say(T(doc.ocrPages ? "ocrEmpty" : "scanned"), "failed"); return; }
    const parts = splitText(text);
    let last = null, runId = null, cached = 0;
    const left = ST.me && ST.me.ai ? ST.me.ai.left : null;
    const warn = left !== null && left < parts.length ? " " + T("docNeeds", parts.length, left) : "";
    for (let i = 0; i < parts.length; i++) {
      say(T("sending", i + 1, parts.length) + warn, "analysing", (100 * i) / parts.length);
      // The AI providers' per-minute limits are shared by every request: when all of them are reached
      // (ai_busy), wait and send the same part again, at most three times.
      for (let k = 0; ; k++) {
        try { last = await api("POST", `/orgs/${orgId}/extract`, { sourceName: f.name, text: parts[i], part: i + 1, parts: parts.length, runId }); break; }
        catch (e) {
          const wait = [20, 40, 60][k];
          if (!(e && e.status === 503 && e.message === "ai_busy") || wait === undefined) throw e;
          for (let sec = wait; sec > 0; sec--) { say(T("aiWait", i + 1, parts.length, sec), "analysing", (100 * i) / parts.length); await sleep(1000); }
        }
      }
      runId = last.id;
      if (last.cached) { cached++; say(T("partCached", i + 1, parts.length), "analysing", (100 * (i + 1)) / parts.length); }
    }
    say(T("filling"), "saving");
    await api("POST", `/orgs/${orgId}/extractions/${runId}/apply`, {});
    j.done = true; j.runId = runId;
    say([f.name, doc.ocrPages ? T("ocrDone", doc.ocrPages) : "", doc.lowConf ? T("ocrLow", doc.lowConf) : "", parts.covered < text.length ? T("tooLong", parts.covered, MAX_PARTS) : "", cached ? T("docCached", cached, parts.length) : ""].filter(Boolean).join(" "), "completed");
    // The organisation on screen is the one the document was for: load the filled profile. Only the Documents page
    // is drawn again (it shows the values found); other pages keep what the member is doing.
    if (ST.org && ST.org.id === orgId) {
      await loadOrg(orgId, true); ST.me = undefined; await loadMe(); ST.resultsKey = null;
      ensureEnglish(document.getElementById("oiTrMsg"));
      if (location.hash === `#org/${orgId}/documents`) { ST.openRun = runId; refresh(); }
    }
  } catch (e) {
    j.err = true;
    say(e.message === "type" ? T("badType") : e.message === "ocr_unavailable" ? T("ocrUnavailable") : errText(e) + (e && e.message === "ai_user_limit" ? " " + T("docResume") : ""), "failed");
  } finally {
    window.removeEventListener("beforeunload", jobGuard);
    jobDraw();
  }
}
afterRender.documents = () => {
  const org = ST.org;
  const show = (run) => { ST.openRun = run.id; const box = document.getElementById("oiReview"); box.innerHTML = fillHTML(run); bindFill(box); box.scrollIntoView({ behavior: "smooth", block: "start" }); };
  // Fill the profile from a stored run; with take/keep, decide conflicts and doubtful values.
  const fill = async (runId, extra = {}) => {
    const r = await api("POST", `/orgs/${org.id}/extractions/${runId}/apply`, extra);
    await loadOrg(org.id, true); ST.me = undefined; await loadMe();
    ensureEnglish(document.getElementById("oiTrMsg"));
    const run = { ...(ST.runs.find((x) => x.id === runId) || {}), result: r.result, status: "applied" };
    ST.runs = ST.runs.map((x) => (x.id === runId ? run : x));
    return run;
  };
  const bindFill = (box) => {
    box.querySelectorAll("[data-take],[data-keep],[data-fill]").forEach((b) => b.addEventListener("click", async () => {
      const msg = box.querySelector(".fill-msg"); b.disabled = true;
      try {
        const run = b.dataset.fill ? await fill(b.dataset.fill) : await fill(b.dataset.run, b.dataset.take ? { take: [b.dataset.take] } : { keep: [b.dataset.keep] });
        show(run);
      } catch (e) { b.disabled = false; if (msg) { msg.className = "note err fill-msg"; msg.textContent = errText(e); } }
    }));
  };
  bindFill(document.getElementById("oiReview"));
  document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => show(ST.runs.find((x) => x.id === b.dataset.open))));
  document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => { await api("DELETE", `/orgs/${org.id}/extractions/${b.dataset.del}`).catch(() => {}); if (ST.openRun === b.dataset.del) ST.openRun = null; refresh(); }));
  const file = document.getElementById("oiFile");
  if (file) file.addEventListener("change", () => {
    const f = file.files[0]; file.value = ""; if (!f) return;
    if (docJobBusy()) { opState(document.getElementById("oiProg"), "failed", T("jobBusy")); return; }
    runDocJob(f);
  });
  jobDraw();
  const web = document.getElementById("oiWeb");
  if (web) web.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const m = document.getElementById("oiWebMsg"); opState(m, "researching", document.getElementById("oiUrl").value);
    try {
      const r = await api("POST", `/orgs/${org.id}/research`, { url: document.getElementById("oiUrl").value });
      ST.runs = [{ id: r.id, kind: "web", sourceName: new URL(r.pages[0]).hostname, sourceUrl: r.pages[0], fields: r.fields, status: "review", at: Date.now() }, ...ST.runs];
      opState(m, "saving", T("filling"));
      const run = await fill(r.id);
      opState(m, "completed", r.pages.join(" · "));
      show(run);
    } catch (e) { opState(m, "failed", errText(e)); }
  });
};

/* ---------- matching ---------- */
// Per grant when the source states it; otherwise the topic budget, labelled as such.
function fundingText(c) {
  const f = c.funding || {}, cur = f.currency || "EUR";
  if (f.maxPerGrant) return (f.minPerGrant && f.minPerGrant !== f.maxPerGrant ? EC.money(f.minPerGrant, cur) + " – " : "") + EC.money(f.maxPerGrant, cur) + " " + T("perGrant");
  if (f.approxPerGrant) return "≈ " + EC.money(f.approxPerGrant, cur) + " " + T("perGrant");
  if (f.topicBudget) return EC.money(f.topicBudget, cur) + " " + T("topicBudget");
  return "";
}
function matchCard(r) {
  const c = r.call, id = ST.org.id, dl = EC.nextDl(c), fund = fundingText(c);
  const probs = r.checks.filter((x) => x.result !== "pass").slice(0, 3), n = mandatorySummary(r.checks);
  const href = `#org/${id}/match/${encodeURIComponent(c.key)}`;
  return `<article class="oi-card match-card">
    <div class="sc"><span class="sc-k">${esc(T("compatK"))}</span>${scoreNum(r.score)}${scoreMeter(r.score)}<span class="fine">${esc(T("bandL." + r.band))}</span></div>
    <div class="mc-main">
      <div class="mc-meta">${statusBadge(r.status)}<span class="mc-req">${esc(T("mreq", n.pass, n.verify, n.fail))}</span></div>
      <h3><a href="${href}">${esc(c.title)}</a></h3>
      <div class="mc-sub"><span>${esc((EC.P[c.programme] || {}).short || c.programmeName || c.programme)}</span>${dl ? `<span>${esc(T("deadline"))}: <b>${esc(EC.fmtDate(dl))}</b> · <span data-dl="${esc(dl)}">${esc(EC.leftText(dl))}</span></span>` : ""}${fund ? `<span>${esc(fund)}</span>` : ""}</div>
      <div class="cols">${r.strengths.length ? `<div><h4>${esc(T("strengths"))}</h4><ul>${r.strengths.slice(0, 2).map((s) => `<li>${esc(codeText(s))}</li>`).join("")}</ul></div>` : ""}
        ${probs.length ? `<div><h4>${esc(T("problems"))}</h4><ul>${probs.map((x) => `<li><span class="res ${x.result}">${esc(T("resL." + x.result))}</span> ${esc(codeText(x).slice(0, 220))}</li>`).join("")}</ul></div>` : ""}
        ${r.missing.length ? `<div><h4>${esc(T("missing"))}</h4><p class="fine">${esc(listOf(r.missing.slice(0, 5), fieldName))}</p></div>` : ""}
        <div><h4>${esc(T("next"))}</h4><p class="fine">${esc(codeText(r.next[0]))}</p></div></div>
      <div class="oi-row"><a class="btn quiet" href="${href}">${esc(T("report"))}</a>${c.url ? `<a class="btn ext" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(T("official"))} <span class="arr">↗</span></a>` : ""}</div>
    </div></article>`;
}
function filtered() {
  const F = ST.filters, now = Date.now();
  let list = results().filter((r) => (!F.status || r.status === F.status) && (!F.prog || r.call.programme === F.prog) && (!F.high || r.score >= HIGH));
  if (F.dl) list = list.filter((r) => { const d = EC.nextDl(r.call); return d && Date.parse(d.slice(0, 10)) - now <= +F.dl * 864e5; });
  if (F.sort === "deadline") list = [...list].sort((a, b) => (EC.nextDl(a.call) || "9").localeCompare(EC.nextDl(b.call) || "9"));
  return list;
}
function matchingHTML() {
  const F = ST.filters, all = results(), list = filtered();
  const progs = [...new Set(all.map((r) => r.call.programme))].sort();
  const sel = (id, opts, v, label) => `<div class="fld"><label for="${id}" class="sr-only">${esc(label)}</label><select id="${id}">${opts.map(([val, lb]) => `<option value="${val}"${String(v) === String(val) ? " selected" : ""}>${esc(lb)}</option>`).join("")}</select></div>`;
  const active = F.status || F.prog || F.dl || F.high || F.sort !== "score";
  return `<header class="m-head"><h1>${esc(T("matchTitle"))}</h1><p class="lede">${esc(T("matchLede", all.length, EC.fmtDate(EC.META.generated)))}</p></header>
    <div class="m-explain">
      <section class="m-ex"><h2><span class="m-ex-ic" aria-hidden="true">✓</span>${esc(T("mxStatusT"))}</h2><p>${esc(T("mxStatus"))}</p></section>
      <section class="m-ex"><h2><span class="m-ex-ic" aria-hidden="true">%</span>${esc(T("mxScoreT"))}</h2><p>${esc(T("mxScore"))}</p>
        <div class="tier-legend" role="list" aria-label="${esc(T("scoreLegend"))}">${["high", "medium", "low"].map((k) => `<span role="listitem" class="sc-chip t-${k}"><b>${esc(T("legendL." + k))}</b>&nbsp;${esc(T("tierL." + k))}</span>`).join("")}</div></section>
    </div>
    <p class="note m-note"><span aria-hidden="true">i</span><span>${esc(T("notice"))}</span></p>
    <section class="oi-card m-tools" aria-label="${esc(T("filtersT"))}">
      <div class="oi-filters">${sel("ofStatus", [["", T("fStatus")], ...Object.keys(STATUS_ORDER).map((s) => [s, T("statusL." + s)])], F.status, T("fStatus"))}
        ${sel("ofProg", [["", T("fProg")], ...progs.map((p) => [p, (EC.P[p] || {}).short || p])], F.prog, T("fProg"))}
        ${sel("ofDl", [["", T("fDl")], ["30", T("dl30")], ["60", T("dl60")], ["120", T("dl120")]], F.dl, T("fDl"))}
        ${sel("ofSort", [["score", T("sortScore")], ["deadline", T("sortDl")]], F.sort, T("sortScore"))}
        <label class="tog"><input type="checkbox" id="ofHigh"${F.high ? " checked" : ""}> <span>${esc(T("onlyHigh"))}</span></label></div>
      <div class="m-count"><p class="fine" role="status">${esc(T("showing", Math.min(F.shown, list.length), list.length))}</p>${active ? `<button type="button" class="linkbtn" id="ofReset">${esc(T("resetF"))}</button>` : ""}</div>
    </section>
    <div class="match-list">${list.slice(0, F.shown).map(matchCard).join("")}</div>
    ${list.length > F.shown ? `<div><button class="btn ghost" id="ofMore">${esc(T("more"))}</button></div>` : ""}`;
}
// Filters re-render the list and keep it in view.
function bindMatching() {
  const F = ST.filters, re = () => { F.shown = 30; refresh(); };
  const on = (id, k, f = (e) => e.value) => { const el = document.getElementById(id); if (el) el.addEventListener("change", () => { F[k] = f(el); re(); }); };
  on("ofStatus", "status"); on("ofProg", "prog"); on("ofDl", "dl"); on("ofSort", "sort"); on("ofHigh", "high", (e) => e.checked);
  const rs = document.getElementById("ofReset"); if (rs) rs.addEventListener("click", () => { Object.assign(F, { status: "", prog: "", dl: "", high: false, sort: "score" }); re(); });
  const m = document.getElementById("ofMore"); if (m) m.addEventListener("click", () => { F.shown += 30; refresh(); });
  if (ST.keepList) { ST.keepList = false; const l = document.getElementById("oiMatches"); if (l) l.scrollIntoView({ block: "start" }); }
}

// One call's assessment as plain data: what a saved report keeps (codes and parameters, not rendered text,
// so a saved report reads in either language).
function snapshot(c, r) {
  const it = (x) => ({ code: x.code, params: x.params || {}, ...(x.result ? { result: x.result } : {}), ...(x.source ? { source: x.source } : {}) });
  return {
    call: { key: c.key, id: c.id, title: c.title, programme: c.programme, programmeName: (EC.P[c.programme] || {}).name || c.programmeName || "", url: c.url || "", deadline: EC.nextDl(c) || "", funding: fundingText(c) || "" },
    assessment: { score: r.score, band: r.band, status: r.status, capApplied: !!r.capApplied, checks: r.checks.map(it), strengths: r.strengths.map(it), gaps: r.gaps.map(it), next: r.next.map(it), missing: r.missing,
      dims: Object.fromEntries(Object.entries(r.dims).map(([k, v]) => [k, v.s])), weights: r.weights },
    dataGenerated: EC.META.generated,
  };
}
// Sections A-F of an eligibility report, from live or saved assessment data.
function reportSections(a, id) {
  const srcLabel = (s) => (s ? T("srcL." + s) : "");
  const n = mandatorySummary(a.checks);
  return `<section class="oi-card"><h2>${esc(T("repA"))}</h2>
      <div class="rep-dims"><div class="rep-dim"><h3>${esc(T("mandT"))}</h3><div class="oi-row">${statusBadge(a.status)}</div><p class="fine">${esc(T("mreq", n.pass, n.verify, n.fail))}</p><p>${esc(T("explain." + a.status))}</p></div>
        <div class="rep-dim"><h3>${esc(T("stratT"))}</h3><div class="oi-row"><span class="score">${scoreNum(a.score)} ${esc(T("bandL." + a.band))}</span></div>${scoreMeter(a.score)}<p class="fine">${esc(T("stratWhat"))}</p>${a.capApplied ? `<p class="fine">${esc(T("capNote"))}</p>` : ""}</div></div>
      <p class="note">${esc(T("notice"))}</p></section>
    <section class="oi-card"><h2>${esc(T("repB"))}</h2><div class="tw"><table class="oi-t"><thead><tr><th>${esc(T("requirement"))}</th><th>${esc(T("result"))}</th><th>${esc(T("basis"))}</th></tr></thead><tbody>
      ${a.checks.map((x) => `<tr><td>${esc(codeText(x))}${x.params.quote ? `<p class="quote">${esc(x.params.quote)}</p>` : ""}${/^https:\/\//i.test(x.params.url || "") ? `<a class="fine" href="${esc(x.params.url)}" target="_blank" rel="noopener">${esc(x.params.title || "Programme Guide")} ↗</a>` : ""}</td><td><span class="res ${x.result}">${esc(x.code === "partnership.unspecified" ? T("notStated") : T("resL." + x.result))}</span></td><td class="fine">${esc(srcLabel(x.source))}</td></tr>`).join("")}
    </tbody></table></div>
    <h3>${esc(T("repB2"))}</h3><div class="dims">${Object.keys(DEFAULT_WEIGHTS).filter((k) => a.dims[k] !== undefined).map((k) => `<div class="dim"><span>${esc(T("dims." + k))}</span><span class="fine num">${esc(T("weight"))} ${a.weights[k]}%</span>${scoreMeter(Math.round(100 * a.dims[k]))}</div>`).join("")}</div></section>
    <section class="oi-card"><h2>${esc(T("repC"))}</h2>${a.strengths.length ? `<ul>${a.strengths.map((x) => `<li>${esc(codeText(x))}</li>`).join("")}</ul>` : `<p class="fine">${esc(T("none"))}</p>`}</section>
    <section class="oi-card"><h2>${esc(T("repD"))}</h2>${a.gaps.length ? `<ul>${a.gaps.map((x) => `<li><span class="res ${x.result}">${esc(T("resL." + x.result))}</span> ${esc(codeText(x))}</li>`).join("")}</ul>` : `<p class="fine">${esc(T("none"))}</p>`}</section>
    <section class="oi-card"><h2>${esc(T("repE"))}</h2>${a.missing.length ? `<p>${esc(listOf(a.missing, fieldName))}</p><p><a href="#org/${id}/profile">${esc(T("fillProfile"))} →</a></p>` : `<p class="fine">${esc(T("missingCall"))}</p>`}</section>
    <section class="oi-card"><h2>${esc(T("repF"))}</h2><ol>${a.next.map((x) => `<li>${esc(codeText(x))}</li>`).join("")}</ol></section>`;
}
const callMeta = (c) => `<div class="oi-row"><span>${esc(c.programmeName || "")}</span>${c.deadline ? `<span>${esc(T("deadline"))}: <b>${esc(EC.fmtDate(c.deadline))}</b></span>` : ""}${c.funding ? `<span>${esc(T("funding"))}: ${esc(c.funding)}</span>` : ""}${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(T("official"))} ↗</a>` : ""}${EC.BYKEY[c.key] ? ` · <a href="#c-${encodeURIComponent(c.key)}">Eligible Calls</a>` : ""}</div>`;
async function secReport(key) {
  const c = EC.BYKEY[decodeURIComponent(key)];
  if (!c) return `<p class="note err">${esc(T("errors.not_found"))}</p>`;
  const r = assess(matchProfile(), c, assessOpts());
  const snap = snapshot(c, r), id = ST.org.id;
  ST.lastSnap = snap;
  return `<a class="back" href="#org/${id}/matching">← ${esc(T("matchTitle"))}</a>
    <h1>${esc(c.title)}</h1>${callMeta(snap.call)}
    ${reportSections(snap.assessment, id)}
    ${officialHTML(c)}
    <section class="oi-card"><h2>${esc(T("repEval"))}</h2>${critHTML((await loadCriteria()).calls[c.id], c)}</section>
    ${canEdit() ? `<section class="oi-card rep-save"><h2>${esc(T("repSaveTitle"))}</h2><p class="fine">${esc(T("repSaveLede"))}</p>
      <div class="oi-row"><div class="fld grow"><label for="rsNote">${esc(T("repNote"))}</label><input type="text" id="rsNote" maxlength="1000" placeholder="${esc(T("repNotePh"))}"></div><button type="button" class="btn" id="rsSave">${esc(T("repSave"))}</button></div>
      <div role="status" id="rsMsg"></div></section>` : ""}
    <p class="fine">${esc(T("assessedAt", fmtTime(Date.now()), ST.org.version, EC.fmtDate(EC.META.generated)))}</p>`;
}
// Where a call's mandatory conditions come from, and the AI check of the profile against that official text.
function officialHTML(c) {
  const e = ST.elig && ST.elig.calls ? ST.elig.calls[c.id] : null;
  const ok = e && e.status === "verified";
  const row = (k, v) => (v ? `<tr><th>${esc(T(k))}</th><td>${v}</td></tr>` : "");
  const src = ok ? `<table class="oi-t off-t"><tbody>${row("offPub", esc(e.publisher || ""))}${row("offDoc", `<a href="${esc(e.docUrl || c.url)}" target="_blank" rel="noopener">${esc(e.title || T("official"))}${e.heading ? " · " + esc(e.heading) : ""} ↗</a>`)}${row("offPublished", e.published ? esc(EC.fmtDate(e.published)) : "")}${row("offVerified", e.verified ? esc(EC.fmtDate(e.verified)) : "")}</tbody></table>`
    : `<p class="note warn">${esc(codeText({ code: "off.unverified", params: { status: (e && e.status) || "not_researched" } }))}</p>`;
  const chk = (ST.off || []).find((x) => x.callId === c.id);
  const stale = chk && chk.profileVersion !== ST.org.version;
  const res = chk ? `<ul class="off-list">${chk.conditions.map((x) => `<li><span class="res ${x.result}">${esc(T("resL." + x.result))}</span> <b>${esc(x.condition)}</b> <span class="fine">(${esc(T("aiApplies." + x.appliesTo))})</span>${x.reason ? `<div class="fine">${esc(x.reason)}</div>` : ""}<p class="quote">${esc(x.quote)}</p></li>`).join("")}</ul>
      ${chk.summary ? `<p>${esc(chk.summary)}</p>` : ""}<p class="fine">${esc(T("aiMade", fmtTime(chk.at)))} · ${chk.source.url ? `<a href="${esc(chk.source.url)}" target="_blank" rel="noopener">${esc(chk.source.title || T("official"))} ↗</a>` : esc(chk.source.title || "")}${stale ? "" : " · " + esc(T("aiCounts"))}</p>${stale ? `<p class="note warn">${esc(T("aiStale", chk.profileVersion))}</p>` : ""}` : "";
  const can = e && e.hasText;
  return `<section class="oi-card off"><h2>${esc(T("offT"))}</h2><p class="fine">${esc(T("offLede"))}</p>${src}
    <h3>${esc(T("aiT"))}</h3><p class="fine">${esc(T("aiLede"))}</p>${res}
    ${can ? (canEdit() ? `<div class="oi-row"><button type="button" class="btn quiet" id="offRun" data-call="${esc(c.id)}"${!chk ? ` data-auto="${esc(c.id + ":" + ST.org.version)}" hidden` : ""}>${esc(T(chk ? "aiRerun" : "aiRun"))}</button></div><div class="op" id="offMsg" role="status" aria-live="polite"></div>` : "") : `<p class="fine">${esc(T("aiNoText"))}</p>`}</section>`;
}
afterRender.match = () => {
  const run = document.getElementById("offRun");
  const check = async () => {
    const m = document.getElementById("offMsg"), id = ST.org.id, route = location.hash;
    run.disabled = true; opState(m, "checking");
    try {
      await api("POST", `/orgs/${id}/official-checks`, { callId: run.dataset.call, lang: L() });
      await loadOfficial(id); ST.resultsKey = null;
      if (location.hash === route) refresh();
    } catch (e) { opState(m, "failed", errText(e)); run.hidden = false; run.disabled = false; }
  };
  if (run) run.addEventListener("click", check);
  // No check yet for this call and profile version: it starts on its own when an editor opens the report. Tried once
  // per call and version in this session, so a failure (limit, budget, model) is shown with the button, not repeated.
  const auto = run && run.dataset.auto;
  if (auto && !(ST.offTried || (ST.offTried = new Set())).has(auto)) { ST.offTried.add(auto); check(); }
  else if (auto) run.hidden = false;
  const b = document.getElementById("rsSave"); if (!b) return;
  const id = ST.org.id, m = document.getElementById("rsMsg");
  b.addEventListener("click", async () => {
    b.disabled = true; opState(m, "saving");
    try {
      const r = await api("POST", `/orgs/${id}/reports`, { ...ST.lastSnap, note: document.getElementById("rsNote").value });
      m.className = "note ok"; m.innerHTML = `${esc(T("repSaved"))} <a href="#org/${id}/reports/${esc(r.report.id)}">${esc(T("repOpenSaved"))} →</a>`;
    } catch (e) { m.className = "note err"; m.textContent = errText(e); b.disabled = false; }
  });
};

/* ---------- evaluation guidelines ---------- */
// Criteria per call (site/org/criteria.json, written by ingest/award_criteria.py) and Erasmus+ KA210/KA220 (erasmus-2026.json).
async function loadCriteria() {
  if (!ST.crit) { try { const r = await fetch("org/criteria.json", { cache: "no-cache" }); ST.crit = r.ok ? await r.json() : { calls: {}, frameworks: {} }; } catch { ST.crit = { calls: {}, frameworks: {} }; } }
  return ST.crit;
}
// Which official application form each call uses (site/org/forms-index.json, written by ingest/app_forms.py).
async function loadFormsIdx() {
  if (ST.formsIdx === undefined) { try { const r = await fetch("org/forms-index.json", { cache: "no-cache" }); ST.formsIdx = r.ok ? await r.json() : null; } catch { ST.formsIdx = null; } }
  return ST.formsIdx;
}
async function loadGuide() { if (!ST.guide) { const r = await fetch("org/erasmus-2026.json", { cache: "no-cache" }); ST.guide = await r.json(); } return ST.guide; }
const ext = (url, label) => (url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>` : "");
const pts = (n) => String(n).replace(/\.0$/, "");
// Official text, kept in its own language (English) and nesting
function textBlocks(blocks) {
  return `<div class="crit-text">${blocks.map((b) => b.head ? `<h4>${esc(b.text)}</h4>` : `<p class="lv${Math.min(b.level || 0, 4)}">${b.level ? "<span aria-hidden=\"true\">• </span>" : ""}${esc(b.text)}</p>`).join("")}</div>`;
}
function heRowHTML(fw, rowId, opts = {}) {
  const row = fw.rows[rowId];
  return `<div class="crit-list">${row.criteria.map((c) => `<div class="crit"><h3><span>${esc(crName(c.name))}</span><span class="fine num">${esc(T("scoreOf5"))}${opts.ia && c.name === "Impact" ? " · " + esc(T("iaWeight")) : ""}</span></h3>
    ${c.name === "Excellence" ? `<p class="fine">${esc(fw.excellenceNote)}</p>` : ""}
    <ul>${c.aspects.map((a) => `<li>${a.stage1 && opts.twoStage !== false ? `<span class="s1" title="${esc(T("stage1Mark"))}">${esc(T("stage1Short"))}</span> ` : ""}${esc(a.text)}</li>`).join("")}</ul></div>`).join("")}</div>
    ${row.note ? `<p class="fine">${esc(row.note)}</p>` : ""}`;
}
function heScoring(fw, e) {
  return `<div class="crit-sum"><span class="sc-chip t-medium">${esc(T("heThresholds"))}</span>${e && e.ia ? `<span class="sc-chip t-medium">${esc(T("iaWeight"))}</span>` : ""}${e && e.twoStage ? `<span class="sc-chip t-medium">${esc(T("twoStageChip"))}</span>` : ""}</div>`;
}
// One call: its criteria from the general annex, its call document, its funder's page, or where to find them
function critHTML(e, c) {
  const crit = ST.crit;
  if (!e) return `<p class="fine">${esc(T("critNone"))}</p>${c && c.url ? `<p>${ext(c.url, T("official"))}</p>` : ""}`;
  const note = e.note ? `<div class="crit-note"><span class="fine">${esc(T("fromCallPage"))}</span><p>${esc(e.note)}</p></div>` : "";
  if (e.kind === "framework") {
    const fw = crit.frameworks[e.framework];
    return `<p class="fine">${esc(T("critFromAnnex", trTitle(fw.rows[e.row].name)))} · ${ext(fw.url, T("heAnnex"))}</p>${heScoring(fw, e)}
      ${e.twoStage ? `<p class="fine">${esc(T("stage1Note"))}</p>` : ""}${heRowHTML(fw, e.row, { ia: e.ia, twoStage: e.twoStage })}${note}`;
  }
  if (e.kind === "document") {
    const t = e.table;
    return `<p class="fine">${esc(T("critFromDoc"))}${e.version ? " (" + esc(e.version) + ")" : ""} · ${ext(e.url, T("callDoc"))}${e.evalForm ? " · " + ext(e.evalForm, T("evalForm")) : ""}</p>
      ${t ? `<div class="tw"><table class="oi-t crit-t"><thead><tr><th>${esc(T("criterion"))}</th><th class="num">${esc(T("minPass"))}</th><th class="num">${esc(T("maxScore"))}</th></tr></thead><tbody>
        ${t.rows.map((r) => `<tr><td>${esc(crName(r.name))}</td><td class="num">${esc(/^n\/a$/i.test(r.min) ? "n/a" : /^-$/.test(r.min) ? "–" : r.min)}</td><td class="num">${esc(pts(r.max))}</td></tr>`).join("")}
        <tr class="tot"><td>${esc(t.total.name)}</td><td class="num">${esc(t.total.min)}</td><td class="num">${esc(pts(t.total.max))}</td></tr></tbody></table></div>${t.rows.some((r) => /^n\/a$/i.test(r.min)) ? `<p class="fine">${esc(T("evNoMin", t.rows.filter((r) => /^n\/a$/i.test(r.min)).map((r) => r.name).join(", ")))}</p>` : ""}` : ""}
      ${e.summary && e.summary.length ? `<ul class="crit-sumtext">${e.summary.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <details class="crit-full"><summary>${esc(T("fullText"))}</summary>${textBlocks(e.blocks)}</details>${note}`;
  }
  if (e.kind === "page") {
    return `<p class="fine">${esc(T("critFromPage", e.source || ""))} · ${ext(e.url, T("official"))}</p><details class="crit-full" open><summary>${esc(e.heading)}</summary>${textBlocks(e.blocks)}</details>`;
  }
  return `<p class="fine">${esc(T(e.note ? "critPointerNote" : "critPointer"))}</p>${note}<p>${ext(e.url || (c && c.url), T(e.url && /\.pdf($|\?)/i.test(e.url) ? "callDoc" : "official"))}${e.evalForm ? " · " + ext(e.evalForm, T("evalForm")) : ""}</p>`;
}
const KIND_ORDER = { framework: 0, document: 0, page: 0, pointer: 1 };
async function secEvaluation() {
  const crit = await loadCriteria();
  const tab = ST.evalTab || "calls", id = ST.org.id;
  const tabs = [["calls", T("evalTabCalls")], ["horizon", "Horizon Europe"], ["erasmus", "Erasmus+ KA210 · KA220"]];
  const head = `<h1>${esc(T("evalTitle"))}</h1><p class="lede">${esc(T("evalLede"))}</p>
    <div class="etabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" class="etab${tab === k ? " on" : ""}" aria-selected="${tab === k}" data-etab="${k}">${esc(l)}</button>`).join("")}</div>
    <p class="fine">${esc(T("evalTabsNote"))}</p>`;
  if (tab === "horizon") {
    const fw = crit.frameworks["HE-GA-D"];
    if (!fw) return head + `<p class="note err">${esc(T("errors.data_unavailable"))}</p>`;
    const n = {}; for (const e of Object.values(crit.calls)) if (e.kind === "framework") n[e.row] = (n[e.row] || 0) + 1;
    return head + `<p class="fine">${ext(fw.url, fw.title)} · ${esc(T("retrieved", fw.retrieved))} · ${esc(T("critNotice"))}</p>
      <section class="oi-card"><h2>${esc(T("heScoringTitle"))}</h2><ul>${fw.scoring.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <h3>${esc(T("heTwoStageTitle"))}</h3><ul>${fw.twoStage.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p class="fine">${esc(T("stage1Note"))}</p></section>
      ${Object.keys(fw.rows).map((k) => `<section class="oi-card"><h2>${esc(trTitle(fw.rows[k].name))}</h2><p class="fine">${esc(T("openCallsUsing", n[k] || 0))}</p>${heRowHTML(fw, k, { twoStage: true })}</section>`).join("")}
      <p class="fine">${esc(T("heOwn"))}</p>`;
  }
  if (tab === "erasmus") {
    const g = await loadGuide();
    return head + `<p class="fine"><a href="${esc(g.guideUrl)}" target="_blank" rel="noopener">${esc(T("guide", g.guideYear, g.guideVersion))} ↗</a> · ${esc(T("guideNotice"))}</p>
    ${g.actions.map((a) => `<section class="oi-card"><h2>${esc(a.id)} · ${esc(nm(a.name))}</h2>
      <p class="fine">${esc(T("where"))} <a href="${esc(g.nationalAgenciesUrl)}" target="_blank" rel="noopener">${esc(T("na"))} ↗</a> · <a href="${esc(a.url)}" target="_blank" rel="noopener">Programme Guide ↗</a></p>
      <p>${esc(T("totalMin", a.threshold.total))}</p>
      <div class="crit-list">${a.criteria.map((c) => `<div class="crit"><h3><span>${esc(crName(c.name))}</span><span class="fine num">${esc(T("maxPts", c.max, c.min))}</span></h3><ul>${c.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("")}</div>
      <h3>${esc(T("rounds"))}</h3><ul>${a.rounds.map((r) => `<li>${esc(r.deadline.slice(0, 10))} ${esc(r.deadline.slice(11, 16))} (Brussels)${r.kind === "optional" ? ", " + esc(T("optional")) : ""}</li>`).join("")}</ul></section>`).join("")}`;
  }
  // By call: the organisation's open calls, most compatible first, with the criteria each one is scored against
  const EF = ST.evalF || (ST.evalF = { prog: "", all: false, shown: 20 });
  const res = results();
  const progs = [...new Set(res.map((r) => r.call.programme))].sort();
  const list = res.filter((r) => (EF.all || r.status !== "ineligible") && (!EF.prog || r.call.programme === EF.prog))
    .sort((a, b) => (KIND_ORDER[(crit.calls[a.callId] || {}).kind] ?? 1) - (KIND_ORDER[(crit.calls[b.callId] || {}).kind] ?? 1) || b.score - a.score);
  const withCrit = list.filter((r) => (crit.calls[r.callId] || {}).kind && crit.calls[r.callId].kind !== "pointer").length;
  return head + `<p class="fine">${esc(T("evalCallsNote"))}</p>
    <div class="oi-row"><select id="evProg" aria-label="${esc(T("progL"))}"><option value="">${esc(T("fProg"))}</option>${progs.map((p) => `<option value="${esc(p)}"${EF.prog === p ? " selected" : ""}>${esc((EC.P[p] || {}).short || p)}</option>`).join("")}</select>
      <label class="opt"><input type="checkbox" id="evAll"${EF.all ? " checked" : ""}> ${esc(T("evalShowIneligible"))}</label></div>
    <p class="fine" role="status">${esc(T("evalCount", list.length, withCrit))}</p>
    <div class="match-list">${list.slice(0, EF.shown).map((r) => { const c = r.call, e = crit.calls[r.callId], dl = EC.nextDl(c);
      return `<details class="oi-card eval-call"><summary><span class="eval-t">${esc(c.title)}</span><span class="oi-row fine"><span>${esc((EC.P[c.programme] || {}).short || c.programme)}</span>${dl ? `<span>${esc(EC.fmtDate(dl))}</span>` : ""}${scoreNum(r.score)}${statusBadge(r.status)}<span class="sc-chip ${e && e.kind !== "pointer" ? "t-high" : "t-low"}">${esc(T("kindL." + (e ? e.kind : "pointer")))}</span></span></summary>
        <div class="eval-body">${critHTML(e, c)}<p class="fine"><a href="#org/${id}/match/${encodeURIComponent(c.key)}">${esc(T("openReport"))} →</a></p></div></details>`; }).join("")}</div>
    ${list.length > EF.shown ? `<button type="button" class="btn ghost" id="evMore">${esc(T("more"))}</button>` : ""}`;
}
afterRender.evaluation = () => {
  document.querySelectorAll("[data-etab]").forEach((b) => b.addEventListener("click", () => { ST.evalTab = b.dataset.etab; refresh(); }));
  const EF = ST.evalF;
  const p = document.getElementById("evProg"); if (p) p.addEventListener("change", () => { EF.prog = p.value; EF.shown = 20; refresh(); });
  const a = document.getElementById("evAll"); if (a) a.addEventListener("change", () => { EF.all = a.checked; EF.shown = 20; refresh(); });
  const m = document.getElementById("evMore"); if (m) m.addEventListener("click", () => { EF.shown += 20; refresh(); });
};
/* ---------- project ideas ---------- */
const IDEA_CALLS = 6;
// Calls offered for ideas: open, not failing a mandatory check, score 50% or more, most compatible first.
const ideaCandidates = () => results().filter((r) => (r.status === "eligible" || r.status === "potential") && r.score >= 50).slice(0, 12);
const ideaReady = (p) => p.name && p.orgType && p.country && (p.description || p.objectives || p.mission);
const premium = () => !!(ST.me && ST.me.access && ST.me.access.active);
// Indicative evaluation of one idea against the award criteria of the call it targets (site/org/rubric.js):
// Horizon Europe General Annex D, the call document, the funder's assessment page, or the Erasmus+ Programme Guide.
// Serbian names of the award criteria and of the fixed scoring rules that the evaluations quote. The official documents
// are in English; on the Serbian page their names are shown in Serbian. Notes taken from a single call's document have
// no fixed wording and are shown as a quotation in English.
const CRIT_SR = {
  "Excellence": "Izvrsnost", "Impact": "Uticaj", "Quality and efficiency of the implementation": "Kvalitet i efikasnost sprovođenja",
  "Relevance": "Relevantnost", "Quality": "Kvalitet", "Quality of content and activities": "Kvalitet sadržaja i aktivnosti", "Project management": "Upravljanje projektom",
  "Dissemination": "Diseminacija", "Implementation": "Sprovođenje", "Relevance and Impact": "Relevantnost i uticaj", "Priority and urgency": "Prioritet i hitnost",
  "Maturity": "Zrelost", "Catalytic effect": "Katalitički efekat", "Effectiveness": "Delotvornost", "Efficiency": "Efikasnost", "Design": "Osmišljenost", "Sustainability": "Održivost",
  "Quality — Project design and implementation": "Kvalitet — osmišljavanje i sprovođenje projekta", "Quality Project design and implementation": "Kvalitet — osmišljavanje i sprovođenje projekta",
  "Quality — Project team and cooperation arrangements": "Kvalitet — projektni tim i aranžmani saradnje", "Quality — Partnership and cooperation arrangements": "Kvalitet — partnerstvo i aranžmani saradnje",
  "Partnership and cooperation arrangements": "Partnerstvo i aranžmani saradnje", "Quality of the project design and implementation": "Kvalitet osmišljavanja i sprovođenja projekta",
  "Quality of the partnership and cooperation arrangements": "Kvalitet partnerstva i aranžmana saradnje",
};
const TITLE_SR = [
  ["Research and innovation actions (RIA), Innovation actions (IA)", "Istraživačke i inovacione akcije (RIA), inovacione akcije (IA)"],
  ["Coordination and support actions (CSA)", "Akcije koordinacije i podrške (CSA)"], ["Programme co-fund actions (CoFund)", "Akcije programskog sufinansiranja (CoFund)"],
  ["Pre-commercial procurement actions (PCP), Public procurement of innovative solutions actions (PPI)", "Predkomercijalne nabavke (PCP), javne nabavke inovativnih rešenja (PPI)"],
  ["Framework Partnership Agreements (FPA)", "Okvirni sporazumi o partnerstvu (FPA)"], ["first stage", "prva faza"],
  ["Award criteria of the call", "Kriterijumi za dodelu iz dokumenta poziva"], ["Assessment described by the funder", "Ocenjivanje kako ga opisuje finansijer"],
];
const NOTE_SR = {
  "Evaluation scores will be awarded for the criteria, and not for the different aspects listed in the table.": "Ocene se dodeljuju za kriterijume, a ne za pojedinačne aspekte navedene u tabeli.",
  "For full applications, each criterion will be scored out of 5. The threshold for individual criteria will be 3. The overall threshold, applying to the sum of the three individual scores, will be 10.": "Kod punih prijava svaki kriterijum se ocenjuje sa najviše 5 bodova. Prag za pojedinačni kriterijum je 3. Ukupni prag, koji se odnosi na zbir tri pojedinačne ocene, iznosi 10.",
  "To determine the ranking for ‘Innovation actions’, the score for ‘Impact’ will be given a weight of 1.5.": "Za rangiranje inovacionih akcija ocena za „Uticaj“ ima ponder 1,5.",
  "Impact has a weight of 1.5 for ranking innovation actions.": "Za rangiranje inovacionih akcija ocena za „Uticaj“ ima ponder 1,5.",
  "For the evaluation of first-stage applications under a two-stage submission procedure, only the ‘Excellence’ and ‘Impact’ criteria will be evaluated. Within these criteria, only the aspects in bold will be considered.": "Kod prijava za prvu fazu postupka u dve faze ocenjuju se samo kriterijumi „Izvrsnost“ i „Uticaj“, i to samo aspekti označeni podebljanim slovima.",
  "The threshold for both individual criteria will be 4.": "Prag za oba pojedinačna kriterijuma je 4.",
  "The threshold is expected normally to be set at 8 or 8.5.": "Ukupni prag se po pravilu postavlja na 8 ili 8,5.",
  "half of each maximum, rounded up": "polovina maksimuma za svaki kriterijum, zaokruženo naviše",
};
const crName = (n) => (L() === "sr" && CRIT_SR[n]) || n;
const trTitle = (t) => (L() === "sr" ? TITLE_SR.reduce((s, [en, sr]) => s.split(en).join(sr), String(t || "")) : t);
const noteText = (n) => (L() === "sr" ? NOTE_SR[n] || null : n);
const evTitle = (e) => trTitle(e.title) || `Erasmus+ ${e.action} · ${nm(e.actionName)}`;
const evSource = (e) => e.sourceUrl ? `<a href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">${esc(e.sourceTitle || T("evSourceDoc"))} ↗</a>` : e.guideUrl ? `<a href="${esc(e.guideUrl)}" target="_blank" rel="noopener">${esc(T("evGuide", e.guideYear, e.guideVersion))} ↗</a>` : esc(e.sourceTitle || "");
const evShort = (e, k) => (e.kind === "horizon" ? "Horizon Europe" : e.kind === "document" ? T("evShortDoc") : e.kind === "text" ? T("evShortText") : k);
const ptsTxt = (n) => (n === null || n === undefined ? "–" : String(Math.round(n * 10) / 10));
// Criteria without an individual minimum, when the documentation does set thresholds elsewhere (CERV: only Relevance
// has one, Quality and Impact are "n/a" in the call document's table): said once, so "–" is not read as missing data.
const noMinNote = (e) => {
  const none = (e.criteria || []).filter((c) => c.min === null || c.min === undefined);
  const hasRule = e.threshold !== null && e.threshold !== undefined || (e.criteria || []).some((c) => c.min !== null && c.min !== undefined);
  return none.length && hasRule ? `<p class="fine">${esc(T("evNoMin", none.map((c) => crName(c.name)).join(", ")))}</p>` : "";
};
function evalHTML(e) {
  const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);
  const verdict = e.passed === true ? `<span class="st eligible">${esc(T("evPass"))}</span>` : e.passed === false ? `<span class="st ineligible">${esc(T("evFail"))}</span>` : `<span class="st potential">${esc(T("evNoThreshold"))}</span>`;
  const mark = (ok) => (ok === true ? " ✓" : ok === false ? " ✗" : "");
  return `<div class="ev-res"><div class="oi-row"><b>${esc(evTitle(e))}</b><span class="sc-chip ${tierCls(pct(e.total, e.max))}">${ptsTxt(e.total)} / ${ptsTxt(e.max)}</span>${verdict}</div>
    <p class="fine">${esc(T("evBasis"))}: ${evSource(e)}${e.threshold !== null && e.threshold !== undefined ? " · " + esc(T("evThreshold", ptsTxt(e.threshold), ptsTxt(e.max))) : " · " + esc(T("evNoTotal"))}${e.kind === "text" ? " · " + esc(T("evTextScale")) : ""}${e.usedProposal ? " · " + esc(T("evUsedProposal")) : ""}</p>
    <div class="tw"><table class="oi-t ev-t"><thead><tr><th>${esc(T("criterion"))}</th><th class="num">${esc(T("evScore"))}</th><th class="num">${esc(T("minPass"))}</th></tr></thead><tbody>
      ${e.criteria.map((c) => `<tr><td>${esc(crName(c.name))}${c.quote ? `<div class="fine">“${esc(c.quote)}”</div>` : ""}</td><td class="num"><b class="scn ${tierCls(pct(c.score, c.max))}">${ptsTxt(c.score)} / ${ptsTxt(c.max)}</b></td><td class="num">${c.min === null || c.min === undefined ? "–" : ptsTxt(c.min) + mark(c.pass)}</td></tr>`).join("")}
      <tr class="tot"><td>${esc(T("evTotal"))}</td><td class="num"><b>${ptsTxt(e.total)} / ${ptsTxt(e.max)}</b></td><td class="num">${e.threshold === null || e.threshold === undefined ? "–" : ptsTxt(e.threshold) + mark(e.passesTotal)}</td></tr></tbody></table></div>
    ${(e.notes || []).length ? `<ul class="fine ev-notes">${e.notes.map((n) => { const t = noteText(n); return t ? `<li>${esc(t)}</li>` : `<li>${esc(T("evNoteQuoted"))} <i lang="en">“${esc(n)}”</i></li>`; }).join("")}</ul>` : ""}
    ${noMinNote(e)}
    ${e.criteria.map((c) => `<details class="ev-c"><summary>${esc(crName(c.name))}: ${ptsTxt(c.score)} / ${ptsTxt(c.max)}</summary><p>${esc(c.justification)}</p>
      ${[["strengths", "evStrengths"], ["weaknesses", "evWeak"], ["missing", "evMissing"], ["recommendations", "evRec"]].filter(([k]) => (c[k] || []).length).map(([k, l]) => `<h4>${esc(T(l))}</h4><ul>${c[k].map((y) => `<li>${esc(y)}</li>`).join("")}</ul>`).join("")}</details>`).join("")}
    ${e.summary ? `<p>${esc(e.summary)}</p>` : ""}${(e.priorityActions || []).length ? `<h4>${esc(T("evPriority"))}</h4><ol>${e.priorityActions.map((y) => `<li>${esc(y)}</li>`).join("")}</ol>` : ""}
    <p class="note">${esc(T("evDisclaimer"))}</p><p class="fine">${esc(T("evMade", fmtTime(e.at)))}</p></div>`;
}
// The rubric the next evaluation of this idea will use (null: the call's criteria are not in the data).
const ideaRubric = (x) => { const c = (EC.CALLS || []).find((y) => y.id === x.callId) || { id: x.callId }; return ST.crit ? rubricFor({ id: x.callId, programme: c.programme }, ST.crit, ST.guide) : null; };
// The evaluation that counts for an idea: the one made with the criteria its call uses now, otherwise the latest one.
const ideaEval = (x) => {
  const evs = x.evaluations || {}, rb = ideaRubric(x);
  if (rb && evs[rb.key]) return evs[rb.key];
  const all = Object.values(evs);
  return all.length ? all.reduce((a, b) => ((b.at || 0) > (a.at || 0) ? b : a)) : null;
};
// Below a documented threshold (an individual minimum or the overall threshold): not offered as a recommendation.
const belowThreshold = (x) => { const e = ideaEval(x); return !!e && e.passed === false; };
// Text in another language than the page and no stored translation yet (the idea or one of its evaluations).
// On the Serbian page the most frequent ijekavian forms and Croatian words left in model text are corrected word by word
// before it is shown (no AI action); what that cannot fix is rewritten by the AI (autoTranslate).
const lexAll = (t) => Object.fromEntries(Object.entries(t).map(([k, v]) => [k, Array.isArray(v) ? v.map(serbianLexFix) : serbianLexFix(v)]));
const ideaIn = (x, lang) => { const it = ideaInRaw(x, lang); return it && lang === "sr" ? applyIdeaTexts(it, lexAll(ideaTexts(it))) : it; };
const evalIn = (e, lang) => { const v = evalInRaw(e, lang); return v && lang === "sr" ? applyEvalTexts(v, lexAll(evalTexts(v))) : v; };
const flatText = (t) => Object.values(t).flat().join(" ");
const srFix = (t) => L() === "sr" && !!nonStandardSerbian(flatText(t));   // Serbian with Croatian words or ijekavian forms
const otherLang = (x) => !ideaIn(x, L()) || Object.values(x.evaluations || {}).some((e) => !evalIn(e, L()))
  || srFix(ideaTexts(ideaIn(x, L()) || x.idea)) || Object.values(x.evaluations || {}).some((e) => evalIn(e, L()) && srFix(evalTexts(evalIn(e, L()))));
// Ideas and evaluations that are in the other language, or not in standard Serbian, get a copy in the page language on
// their own: one idea at a time, at most 6 per visit, each tried once per session (one AI action per idea).
async function autoTranslate() {
  if (ST.translating || !ST.org) return;
  const tried = ST.trTried || (ST.trTried = new Set()), lang = L();
  const todo = (ST.ideas || []).filter((x) => otherLang(x) && !tried.has(x.id + ":" + lang)).slice(0, 6);
  if (!todo.length) return;
  ST.translating = true;
  for (const x of todo) {
    tried.add(x.id + ":" + lang);
    const m = document.querySelector(`article.idea[data-idea="${CSS.escape(x.id)}"] [data-trmsg]`);
    if (m) opState(m, "analysing", T("trBusy"));
    try {
      Object.assign(x, (await api("POST", `/orgs/${ST.org.id}/ideas/${x.id}/translate`, { lang })).idea);
      if (L() === lang && /\/ideas/.test(location.hash)) await refresh();   // each idea is shown as soon as its copy is ready
    } catch (e) {
      const m2 = document.querySelector(`article.idea[data-idea="${CSS.escape(x.id)}"] [data-trmsg]`);
      if (m2) opState(m2, "failed", errText(e)); if (e && (e.status === 429 || e.status === 503)) break;
    }
  }
  ST.translating = false;
}
const MAX_REVISIONS = 2;   // src/org/ideas.js
function evalBox(x) {
  const evs = x.evaluations || {}, keys = Object.keys(evs), rb = ideaRubric(x);
  const sel = ST.evalSel[x.id] && evs[ST.evalSel[x.id]] ? ST.evalSel[x.id] : rb && evs[rb.key] ? rb.key : keys[keys.length - 1];
  const call = (EC.CALLS || []).find((y) => y.id === x.callId);
  const link = (ST.crit && ST.crit.calls[x.callId] && ST.crit.calls[x.callId].url) || (call && call.url);
  const basis = rb ? `<p class="fine">${esc(T("evWill"))} <b>${esc(trTitle(rb.title))}</b> · ${rb.url ? `<a href="${esc(rb.url)}" target="_blank" rel="noopener">${esc(rb.sourceTitle)} ↗</a>` : esc(rb.sourceTitle)}${rb.criteria ? ` · ${esc(T("evCritList", rb.criteria.map((c) => `${crName(c.name)} (${ptsTxt(c.max)})`).join(", ")))}` : ` · ${esc(T("evTextScale"))}`}</p>`
    : `<p class="note">${esc(T("evNoCriteria"))}${link ? ` <a href="${esc(link)}" target="_blank" rel="noopener">${esc(T("official"))} ↗</a>` : ""}</p>`;
  return `<details class="ev-box"${keys.length ? " open" : ""}><summary>${esc(T("evTitle"))}${keys.length ? ` · ${keys.map((k) => `${esc(evShort(evs[k], k))} ${ptsTxt(evs[k].total)}/${ptsTxt(evs[k].max)}`).join(" · ")}` : ""}</summary>
    <p class="fine">${esc(T("evLede"))}</p>${basis}
    ${keys.length > 1 ? `<div class="oi-row"><select data-evsel aria-label="${esc(T("evShown"))}">${keys.map((k) => `<option value="${esc(k)}"${sel === k ? " selected" : ""}>${esc(evTitle(evs[k]))}</option>`).join("")}</select></div>` : ""}
    ${canEdit() && rb ? `<div class="oi-row"><button type="button" class="btn quiet" data-act="evaluate"${premium() ? "" : " disabled"}>${esc(T(evs[rb.key] ? "evRerun" : "evRun"))}${premium() ? "" : " · " + esc(T("premiumTag"))}</button><span class="fine" role="status" data-evmsg></span></div>` : ""}
    ${sel ? evalHTML(evalIn(evs[sel], L()) || evs[sel]) : ""}</details>`;
}
// Why the concept received its fit estimate: written by the AI for this concept and this call, checked to name the
// concept's own elements (src/org/ideas.js cleanExplanation). Ideas without one can ask for it.
function fitExplainHTML(x, it = x.idea) {
  const ex = it.fit && it.fit.explanation;
  if (!ex) return canEdit() ? `<div class="fit-ex empty"><button type="button" class="linkbtn" data-act="explain">${esc(T("fitExplainRun"))}</button><span class="op" data-exmsg role="status"></span></div>` : "";
  const col = (k, l) => (ex[k] && ex[k].length ? `<div><h5>${esc(T(l))}</h5><ul>${ex[k].map((y) => `<li>${esc(y)}</li>`).join("")}</ul></div>` : "");
  return `<div class="fit-ex"><h4>${esc(T("fitExplainT"))}</h4><p>${esc(ex.summary)}</p><div class="fit-cols">${col("strengths", "fitStrengths")}${col("weaknesses", "fitWeak")}${col("improve", "fitImprove")}</div></div>`;
}
function ideaCard(x, res) {
  const org = ST.org, it = ideaIn(x, L()) || x.idea, live = res.find((r) => r.callId === x.callId);
  const other = otherLang(x);
  const call = live ? live.call : (EC.CALLS || []).find((c) => c.id === x.callId);
  const dl = call && EC.nextDl(call);
  const score = live ? live.score : x.match.score, status = live ? live.status : x.match.status;
  const fit = x.match && x.match.conceptFit;
  const sec = (k) => { const v = it[k]; if (!v || (Array.isArray(v) && !v.length)) return ""; return `<div><h4>${esc(T("ideaF." + k))}</h4>${Array.isArray(v) ? `<ul>${v.map((y) => `<li>${esc(y)}</li>`).join("")}</ul>` : `<p>${esc(v)}</p>`}</div>`; };
  const ratings = ["alignment", "priorities", "feasibility", "impact"].filter((k) => it.fit && it.fit[k]);
  return `<article class="oi-card idea" data-idea="${esc(x.id)}">
    <div class="oi-row">${x.status === "saved" ? `<span class="sc-chip t-high">★ ${esc(T("ideaSavedChip"))}</span>` : belowThreshold(x) ? "" : `<span class="fine">#${x.rank}</span>`}${belowThreshold(x) ? `<span class="st ineligible">${esc(T("ideaBelowChip"))}</span>` : ""}<span class="ai-tag">AI</span><span class="fine">${esc(T("ideasAi"))}</span></div>
    <h3>${esc(it.title)}</h3>
    ${other ? `<p class="note">${esc(T("trNeeded"))} <button type="button" class="linkbtn" data-act="translate">${esc(T("trRun"))}</button><span class="op" data-trmsg role="status"></span></p>` : ""}
    <p>${esc(it.concept)}</p>
    ${it.previous ? `<p class="fine">${esc(T("revised", it.revisions || 1, ptsTxt(it.previous.evaluation && it.previous.evaluation.total), ptsTxt(it.previous.evaluation && it.previous.evaluation.max)))}</p>` : ""}
    ${belowThreshold(x) && canEdit() && (x.idea.revisions || 0) < MAX_REVISIONS ? `<div class="oi-row"><button type="button" class="btn quiet" data-act="improve"${premium() ? "" : " disabled"}>${esc(T("improveRun"))}${premium() ? "" : " · " + esc(T("premiumTag"))}</button><span class="op" data-immsg role="status"></span></div>` : ""}
    <div class="idea-call"><span class="fine">${esc(T("ideaCall"))}</span>
      ${call ? `<a href="#org/${org.id}/match/${encodeURIComponent(call.key)}">${esc(call.title)}</a>` : `<span>${esc(x.callTitle || x.callId)}</span>`}
      <div class="oi-row">${call ? `<span>${esc((EC.P[call.programme] || {}).short || call.programmeName || call.programme)}</span>` : ""}${dl ? `<span>${esc(T("deadline"))}: <b>${esc(EC.fmtDate(dl))}</b> · <span data-dl="${esc(dl)}">${esc(EC.leftText(dl))}</span></span>` : `<span class="note warn">${esc(T("ideaClosed"))}</span>`}${call && call.url ? `<a class="fine" href="${esc(call.url)}" target="_blank" rel="noopener">${esc(T("official"))} ↗</a>` : ""}</div></div>
    <div class="idea-scores">
      <div><span class="fine">${esc(T("compatRule"))}</span><div class="oi-row">${scoreNum(score)}${statusBadge(status)}</div>${scoreMeter(score)}</div>
      <div><span class="fine">${esc(T("conceptFitL"))}</span><div class="oi-row">${fit == null ? "<b>–</b>" : scoreNum(fit)}</div>${fit == null ? "" : scoreMeter(fit)}</div>
    </div>
    <p class="fine">${esc(T("conceptFitBasis"))}</p>
    ${fit == null ? "" : fitExplainHTML(x, it)}
    ${x.profileVersion !== ST.org.version ? `<p class="fine">${esc(T("ideaStale", x.profileVersion))}</p>` : ""}
    ${appTpl(x) ? appTools(x, appTpl(x)) : `<div class="idea-tools">
      <button type="button" class="btn pdf" data-act="pdf"${premium() || x.proposal ? "" : ` aria-describedby="pw-${esc(x.id)}"`}${x.proposal || (premium() && canEdit()) ? "" : " disabled"}><span class="pdf-ic" aria-hidden="true">PDF</span> ${esc(T(x.proposal ? "pdfDownload" : "pdfCreate"))}${premium() || x.proposal ? "" : ` <span class="lock">${esc(T("premiumTag"))}</span>`}</button>
      ${x.proposal && premium() && canEdit() ? `<button type="button" class="linkbtn" data-act="pdfnew">${esc(T("pdfRegenerate"))}</button>` : ""}
      ${premium() || x.proposal ? "" : `<span class="fine" id="pw-${esc(x.id)}">${esc(T("premiumNeeded"))}${canEdit() ? ` <a href="#oiPaywall" data-pw>${esc(T("premiumHow"))}</a>` : ""}</span>`}
      <span class="fine" role="status" data-pdfmsg></span>
    </div>`}
    <details class="idea-more"><summary><span class="t">${esc(T("ideaMore"))}</span><span class="s">${esc(T("ideaMoreHint"))}</span></summary>
      <div class="idea-body">${["problem", "solution", "objectives", "targetGroups", "activities", "methodology", "workPlan", "expectedResults", "impactPathway", "dissemination", "management", "potentialPartners", "whyItFits"].map(sec).join("")}
      ${ratings.length ? `<div><h4>${esc(T("fitTitle"))}</h4><ul>${ratings.map((k) => `<li>${esc(T("fitL." + k))}: ${it.fit[k]}/5</li>`).join("")}</ul>${it.fit.reasons ? `<p class="fine">${esc(it.fit.reasons)}</p>` : ""}</div>` : ""}</div>
      <p class="fine">${esc(T("ideaGen", fmtTime(x.createdAt), x.match.score))}</p></details>
    ${evalBox(x)}
    ${canEdit() ? `<div class="idea-notes"><label for="n-${esc(x.id)}">${esc(T("ideaNotes"))}</label><textarea id="n-${esc(x.id)}" rows="2" maxlength="4000">${esc(x.notes || "")}</textarea></div>
    <div class="oi-row"><button type="button" class="btn quiet" data-act="save">${esc(T(x.status === "saved" ? "ideaUnsave" : "ideaSave"))}</button><button type="button" class="btn ghost" data-act="notes">${esc(T("ideaNotesSave"))}</button>
      <label class="opt"><input type="checkbox" data-act="compare"${ST.compare.has(x.id) ? " checked" : ""}> ${esc(T("ideaCompare"))}</label><button type="button" class="linkbtn" data-act="del">${esc(T("ideaDelete"))}</button><span class="fine" role="status" data-msg></span></div>`
    : x.notes ? `<div class="idea-notes"><h4>${esc(T("ideaNotes"))}</h4><p>${esc(x.notes)}</p></div>` : `<label class="opt"><input type="checkbox" data-act="compare"${ST.compare.has(x.id) ? " checked" : ""}> ${esc(T("ideaCompare"))}</label>`}
  </article>`;
}
function compareHTML(ideas, res) {
  const pick = ideas.filter((x) => ST.compare.has(x.id)).slice(0, 3);
  if (pick.length < 2) return `<p class="fine">${esc(T("compareHint"))}</p>`;
  const cell = (x, k) => { const live = res.find((r) => r.callId === x.callId);
    if (k === "call") { const c = live && live.call; const dl = c && EC.nextDl(c); return `${esc(c ? c.title : x.callTitle)}${dl ? `<div class="fine">${esc(EC.fmtDate(dl))}</div>` : ""}`; }
    if (k === "compat") return scoreNum(live ? live.score : x.match.score);
    if (k === "fit") return x.match.conceptFit == null ? "–" : scoreNum(x.match.conceptFit);
    if (k === "notes") return esc(x.notes || "–");
    const v = (ideaIn(x, L()) || x.idea)[k]; return Array.isArray(v) ? `<ul>${v.map((y) => `<li>${esc(y)}</li>`).join("")}</ul>` : esc(v || "–"); };
  const rows = [["title", T("ideasTitle")], ["call", T("ideaCall")], ["compat", T("compatRule")], ["fit", T("conceptFitL")], ["objectives", T("ideaF.objectives")], ["targetGroups", T("ideaF.targetGroups")], ["potentialPartners", T("ideaF.potentialPartners")], ["notes", T("ideaNotes")]];
  return `<div class="tw"><table class="oi-t cmp"><tbody>${rows.map(([k, l]) => `<tr><th scope="row">${esc(l)}</th>${pick.map((x) => `<td>${k === "title" ? `<b>${esc((ideaIn(x, L()) || x.idea).title)}</b>` : cell(x, k)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
// Proposal PDF, drawn in the browser with pdfmake from the stored proposal JSON. Roboto (bundled with pdfmake)
// covers Serbian Latin and Cyrillic, so nothing is uploaded and nothing is rasterised.
const PDFMAKE = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/pdfmake.min.js";
const PDFFONTS = "https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.10/vfs_fonts.min.js";
async function loadPdfMake() { if (!window.pdfMake || !window.pdfMake.vfs) { await EC.loadScript(PDFMAKE); await EC.loadScript(PDFFONTS); } return window.pdfMake; }
const fileSafe = (s) => String(s || "proposal").normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "proposal";
function proposalDoc(x, p, orgName) {
  const P = (k) => T("pdf." + k), n = { v: 0 };
  const H = (k) => ({ text: `${++n.v}. ${P(k)}`, style: "h2", tocItem: false });
  const para = (t) => (t ? { text: t, margin: [0, 0, 0, 6] } : { text: P("tbc"), italics: true, color: "#777", margin: [0, 0, 0, 6] });
  const ul = (a) => (a && a.length ? { ul: a, margin: [0, 0, 0, 6] } : para(""));
  const table = (head, rows, widths) => (rows.length ? { table: { headerRows: 1, widths, body: [head.map((h) => ({ text: h, style: "th" })), ...rows] }, layout: "lightHorizontalLines", margin: [0, 2, 0, 8] } : para(""));
  const it = x.idea, b = p.budget || {}, c = p.call || {};
  const money = (v) => new Intl.NumberFormat(L() === "sr" ? "sr-Latn-RS" : "en-GB", { maximumFractionDigits: 0 }).format(v);
  const content = [
    { text: p.title || it.title, style: "h1" },
    { text: [orgName ? `${P("applicant")}: ${orgName}\n` : "", `${P("call")}: ${c.title || x.callTitle || ""}${c.programme ? " (" + c.programme + ")" : ""}\n`,
      c.deadline ? `${P("deadline")}: ${EC.fmtDate(c.deadline)}\n` : "", p.durationMonths ? `${P("duration")}: ${p.durationMonths} ${P("months")}\n` : "",
      `${P("made")}: ${fmtTime(p.at)}`], style: "meta" },
    { text: P("disclaimer"), style: "note" },
    H("concept"), para(p.summary),
    H("problem"), para(p.problem),
    H("mainObjectives"), ul(p.mainObjectives),
    H("specificObjectives"), ul(p.specificObjectives),
    H("targetGroups"), table([P("group"), P("description"), P("reach")], (p.targetGroups || []).map((g) => [g.group, g.description || "", g.reach || ""]), ["28%", "*", "18%"]),
    H("workPackages"), ...(p.workPackages || []).flatMap((w) => [
      { text: `${w.id}: ${w.title}`, style: "h3" },
      { text: [w.months ? `${P("period")}: ${w.months}` : "", w.lead ? `   ${P("lead")}: ${w.lead}` : ""], style: "small" },
      { text: P("activities"), bold: true, margin: [0, 4, 0, 2] }, ul(w.activities),
      { text: P("deliverables"), bold: true, margin: [0, 0, 0, 2] }, ul(w.deliverables)]),
    H("methodology"), para(p.methodology),
    H("outputs"), table([P("output"), P("indicator"), P("target")], (p.outputs || []).map((o) => [o.output, o.indicator || "", o.target || ""]), ["38%", "*", "18%"]),
    H("impact"), para(p.impact),
    H("partnership"), para(p.partnership && p.partnership.structure),
    table([P("partnerProfile"), P("country"), P("role")], ((p.partnership && p.partnership.partners) || []).map((q) => [q.profile, q.country || "", q.role || ""]), ["32%", "16%", "*"]),
    H("timeline"), table([P("phase"), P("period"), P("milestones")], (p.timeline || []).map((t) => [t.phase, t.period || "", (t.milestones || []).join("\n")]), ["30%", "14%", "*"]),
    H("monitoring"), para(p.monitoring),
    H("sustainability"), para(p.sustainability),
    H("risks"), table([P("risk"), P("likelihood"), P("mitigation")], (p.risks || []).map((r) => [r.risk, P("lk." + r.likelihood), r.mitigation || ""]), ["36%", "14%", "*"]),
    H("alignment"), para(p.alignment),
    H("budget"),
    { text: b.requestedTotal ? `${P("requested")}: ${money(b.requestedTotal)} ${c.currency || "EUR"}${c.maxPerProject ? ` (${P("callMax")} ${money(c.maxPerProject)} ${c.currency || "EUR"})` : ""}` : P("noTotal"), margin: [0, 0, 0, 4] },
    b.basis ? para(b.basis) : "",
    table([P("category"), P("share"), P("indicative"), P("noteCol")], (b.categories || []).map((k) => [k.category, k.share + " %", b.requestedTotal ? money((b.requestedTotal * k.share) / 100) : "", k.note || ""]), ["30%", "10%", "16%", "*"]),
    b.considerations ? para(b.considerations) : "",
  ].filter(Boolean);
  return {
    info: { title: p.title || it.title, creator: "Eligible Calls" }, pageSize: "A4", pageMargins: [50, 56, 50, 56], content,
    footer: (cur, tot) => ({ columns: [{ text: "Eligible Calls · " + P("footer"), fontSize: 7, color: "#888" }, { text: `${cur} / ${tot}`, alignment: "right", fontSize: 7, color: "#888" }], margin: [50, 20, 50, 0] }),
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.25 },
    styles: { h1: { fontSize: 18, bold: true, margin: [0, 0, 0, 8] }, h2: { fontSize: 13, bold: true, color: "#1f4e79", margin: [0, 12, 0, 5] }, h3: { fontSize: 11, bold: true, margin: [0, 6, 0, 1] },
      meta: { fontSize: 9, color: "#444", margin: [0, 0, 0, 8] }, note: { fontSize: 8, italics: true, color: "#666", margin: [0, 0, 0, 6] }, small: { fontSize: 9, color: "#555" }, th: { bold: true, fontSize: 9 } },
  };
}
async function downloadProposal(x, p) {
  const pm = await loadPdfMake();
  await new Promise((res, rej) => { try { pm.createPdf(proposalDoc(x, p, ST.org && ST.org.profile && ST.org.profile.name)).download(fileSafe(p.title || x.idea.title) + ".pdf", res); } catch (e) { rej(e); } });
}
// ---------- Full application (v2): official template, written part by part (site/org/templates.js, src/org/proposal.js) ----------
const DOCXJS = "https://cdn.jsdelivr.net/npm/docx@9.5.1/dist/index.iife.js";
const appTpl = (x) => (ST.crit ? templateFor(x.callId, ST.crit, ST.formsIdx, ideaRubric(x)) : null);
const epRules = (tpl) => { const a = tpl && tpl.action && ST.guide && ST.guide.actions.find((y) => y.id === tpl.action); return a ? { ...a.rules, fields: a.fields } : null; };
const fmtInt = (n, lang) => new Intl.NumberFormat((lang || L()) === "sr" ? "sr-Latn-RS" : "en-GB", { maximumFractionDigits: 0 }).format(n);
const docL = (lang) => ({ ...S[lang === "sr" ? "sr" : "en"].app.doc, money: (n) => fmtInt(n, lang) });
if (!ST.drafts) ST.drafts = {};
if (!ST.appOpen) ST.appOpen = new Set();
const unitTitle = (u, d) => {
  if (u.n) {
    if (u.ref) { const w = (d.plan.workPackages || []).find((x) => x.id === u.ref); return `${u.n} ${u.ref}: ${w ? w.title : ""}`; }
    return `${u.n === "0" ? "" : u.n + " "}${u.title}${u.part ? " · " + u.part : ""}`;
  }
  let t = u.section + (u.sub ? " · " + u.sub : "") + (u.part ? " (" + u.part + ")" : "");
  if (u.ref) { const w = (d.plan.workPackages || []).find((x) => x.id === u.ref), a = (d.plan.activities || []).find((x) => x.id === u.ref); t += " · " + (w ? `${w.id}: ${w.title}` : a ? a.title : u.ref); }
  return t + (u.english ? " (English)" : "");
};
function appTools(x, tpl) {
  const p = x.proposal && x.proposal.v === 2 ? x.proposal : null, old = x.proposal && !x.proposal.v ? x.proposal : null;
  const can = premium() && canEdit(), src = tpl.source;
  return `<div class="idea-tools app-tools" data-app>
    <div class="app-head"><b>${esc(T("app.title"))}</b><span class="fine">${tpl.basis === "criteria" || tpl.basis === "general" ? esc(T(tpl.basis === "criteria" ? "app.basisCriteria" : "app.basisGeneral")) : `${esc(T("app.follows"))}: ${esc(tpl.name)} · ${esc(src.title)}${src.version ? ", " + esc(src.version) : ""}${src.date ? ` (${esc(src.date)})` : ""}`}${src.url ? ` <a href="${esc(src.url)}" target="_blank" rel="noopener">↗</a>` : ""}</span></div>
    <p class="fine">${esc(T("app.lede"))}</p>
    <div class="oi-row">
      ${p ? `<button type="button" class="btn pdf" data-act="appopen" aria-expanded="${ST.appOpen.has(x.id)}">${esc(T(ST.appOpen.has(x.id) ? "app.hide" : "app.open"))}</button><span class="fine">${esc(T("app.partsWritten", p.written || 0))}</span>`
        : `<button type="button" class="btn pdf" data-act="appstart"${can ? "" : " disabled"}>${esc(T("app.start"))}${premium() ? "" : ` <span class="lock">${esc(T("premiumTag"))}</span>`}</button>`}
      ${p && can ? `<button type="button" class="linkbtn" data-act="appagain">${esc(T("app.again"))}</button>` : ""}
      ${old ? `<button type="button" class="linkbtn" data-act="pdf">${esc(T("app.earlier"))}</button>` : ""}
      ${premium() ? "" : `<span class="fine">${esc(T("app.premium"))}${canEdit() ? ` <a href="#oiPaywall" data-pw>${esc(T("premiumHow"))}</a>` : ""}</span>`}
    </div>
    <span class="op" data-appmsg role="status"></span><span class="fine" role="status" data-pdfmsg></span>
    <div data-appbody></div>
  </div>`;
}
function factsForm(x, tpl, prev) {
  const f = prev || {}, ep = tpl.programme === "erasmus", r = epRules(tpl) || {}, id = esc(x.id);
  const call = (EC.CALLS || []).find((c) => c.id === x.callId), max = (call && call.funding && call.funding.maxPerGrant) || null;
  const lang = f.lang || (ep ? L() : "en"), min = ep ? r.minOrganisations || 2 : tpl.minParticipants || 1;
  const sel = (n, opts, v) => `<select id="${n}-${id}" name="${n}">${opts.map(([k, l]) => `<option value="${esc(k)}"${String(v ?? "") === String(k) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  const ta = (n, label, v, ph = "") => `<label class="app-f wide"><span>${esc(label)}</span><textarea name="${n}" rows="3" maxlength="3000"${ph ? ` placeholder="${esc(ph)}"` : ""}>${esc(v || "")}</textarea></label>`;
  const trl = [["", "–"], ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, "TRL " + n])];
  return `<form class="app-form" data-appform>
    <h4>${esc(T("app.fTitle"))}</h4><p class="note">${esc(T("app.fNote"))}</p>
    <div class="app-grid">
      <label class="app-f"><span>${esc(T("app.fLang"))}</span>${sel("lang", [["en", "English"], ["sr", "Srpski"]], lang)}<span class="fine">${esc(T(ep ? "app.fLangEp" : "app.fLangHe"))}</span></label>
      <label class="app-f"><span>${esc(T("app.fDur"))}</span><input type="number" name="durationMonths" min="${r.durationMonths ? r.durationMonths[0] : 6}" max="${r.durationMonths ? r.durationMonths[1] : 72}" value="${esc(f.durationMonths || "")}"${r.durationMonths ? ` placeholder="${r.durationMonths[0]}–${r.durationMonths[1]}"` : ""}></label>
      ${ep ? `<label class="app-f"><span>${esc(T("app.fLump"))}</span>${sel("amount", [["", T("app.fLumpPick")], ...(r.lumpSums || []).map((v) => [v, fmtInt(v)])], f.amount)}</label>
        <label class="app-f"><span>${esc(T("app.fField"))}</span>${sel("field", [["", T("app.fLumpPick")], ...(r.fields || Object.keys(ERASMUS_FIELDS)).map((k) => [k, T("app.fields." + k)])], f.field)}</label>`
      : `<label class="app-f"><span>${esc(T("app.fAmount"))}</span><input type="number" name="amount" min="0" step="1000"${max ? ` max="${max}"` : ""} value="${esc(f.amount || "")}">${max ? `<span class="fine">${esc(T("app.fAmountMax", fmtInt(max)))}</span>` : ""}</label>
        <label class="app-f"><span>${esc(T("app.fRole"))}</span>${sel("role", [["coordinator", T("app.fCoord")], ["partner", T("app.fPartner")]], f.role)}</label>
        <label class="opt app-f wide"><input type="checkbox" name="lumpSumFunding"${f.lumpSumFunding ? " checked" : ""}> ${esc(T("app.fLumpTopic"))}</label>
        ${tpl.key !== "HE-CSA" ? `<div class="app-f"><span>${esc(T("app.fTrl"))}</span><div class="oi-row">${esc(T("app.fTrlStart"))} ${sel("trlStart", trl, f.trl && f.trl.start)} ${esc(T("app.fTrlEnd"))} ${sel("trlEnd", trl, f.trl && f.trl.end)}</div></div>` : ""}`}
      <label class="app-f wide"><span>${esc(T("app.fPartners"))}</span><textarea name="partners" rows="4" maxlength="6000" placeholder="${esc(T("app.fPartnersPh"))}">${esc(f.partners ? factsText(f) : "")}</textarea>${min > 1 ? `<span class="fine">${esc(T("app.fPartnersHint", min))}</span>` : ""}</label>
      ${ta("team", T("app.fTeam"), f.team)}${ta("track", T("app.fTrack"), f.track)}${ta("extra", T("app.fExtra"), f.extra)}
    </div>
    <div class="oi-row"><button type="submit" class="btn">${esc(T("app.fGo"))}</button><button type="button" class="btn ghost" data-act="appcancel">${esc(T("app.fCancel"))}</button></div>
  </form>`;
}
function readFacts(form) {
  const v = (n) => { const el = form.elements[n]; return el ? (el.type === "checkbox" ? el.checked : el.value) : undefined; };
  return { lang: v("lang"), durationMonths: v("durationMonths"), amount: v("amount"), field: v("field") || undefined, role: v("role"), lumpSumFunding: !!v("lumpSumFunding"),
    trl: { start: v("trlStart"), end: v("trlEnd") }, partners: v("partners"), team: v("team"), track: v("track"), extra: v("extra") };
}
const viewText = (t) => textParts(String(t || "").replace(/^### (.*)$/gm, "\u0000$1\u0000")).map((x) => x.ul ? `<ul>${x.ul.map((li) => `<li>${esc(li)}</li>`).join("")}</ul>` : x.p.split("\u0000").map((seg, i) => (i % 2 ? `<strong class="sub">${esc(seg)}</strong>` : seg.trim() ? `<p>${esc(seg.trim())}</p>` : "")).join("")).join("");
function unitHTML(u, d, tpl, can) {
  const s = d.sections[u.key], chars = (t) => esc(T("app.chars", String(t || "").length));
  const body = tpl.kind === "form"
    ? u.questions.map((q) => { const a = (s && s.answers && s.answers[q.id]) || ""; return `<div class="app-q"><p class="q">${esc(q.q)}</p><div class="a" data-q="${esc(q.id)}">${a ? viewText(a) : `<span class="fine">${esc(T("app.unitMissing"))}</span>`}</div><div class="oi-row"><span class="fine num">${chars(a)}</span>${a ? `<button type="button" class="linkbtn" data-copy="${esc(q.id)}">${esc(T("app.copy"))}</button>` : ""}</div></div>`; }).join("")
    : `<div class="a">${s && s.text ? viewText(s.text) : `<span class="fine">${esc(T("app.unitMissing"))}</span>`}</div>`;
  return `<details class="app-unit" data-unit="${esc(u.key)}"><summary><span class="t">${esc(unitTitle(u, d))}</span><span class="fine">${s && s.text ? chars(s.text) : esc(T("app.unitMissing"))}${s && s.edited ? " · " + esc(T("app.edited")) : ""}</span></summary>
    <div class="app-u-body">${body}<div class="oi-row">${can && s && s.text ? `<button type="button" class="btn quiet" data-uact="edit">${esc(T("app.edit"))}</button>` : ""}${can ? `<button type="button" class="linkbtn" data-uact="rewrite">${esc(T(s && s.text ? "app.rewrite" : "app.cont"))}</button>` : ""}${tpl.kind !== "form" && s && s.text ? `<button type="button" class="linkbtn" data-uact="copy">${esc(T("app.copy"))}</button>` : ""}<span class="fine" data-umsg role="status"></span></div></div></details>`;
}
const numArg = (a) => (Array.isArray(a) ? a.map(numArg) : typeof a === "number" && a >= 1000 ? fmtInt(a) : a);
function viewerHTML(x, tpl, d) {
  const can = premium() && canEdit(), units = unitsOf(tpl, d.plan, d.facts.lang);
  const missing = units.filter((u) => !(d.sections[u.key] && d.sections[u.key].text)).length;
  const checks = checkDraft(d, { rules: epRules(tpl), callMax: d.call && d.call.maxPerProject });
  return `<div class="app-view">
    <div class="oi-row"><button type="button" class="btn" data-act="apppdf"><span class="pdf-ic" aria-hidden="true">PDF</span> ${esc(T("app.pdf"))}</button><button type="button" class="btn quiet" data-act="appdocx">${esc(T("app.docx"))}</button>${missing && can ? `<button type="button" class="btn quiet" data-act="appcont">${esc(T("app.cont"))}</button>` : ""}</div>
    <p class="note">${esc(tpl.kind === "partb" ? T("app.heNote") : T("app.declaration") + " " + T("app.formLimits"))}</p>
    <h4>${esc(T("app.checks"))}</h4><ul class="app-checks">${checks.map((c) => `<li class="chk-${c.level}">${esc(T("app.chk." + c.key, ...c.args.map(numArg)))}</li>`).join("")}</ul>
    <div class="app-units">${units.map((u) => unitHTML(u, d, tpl, can)).join("")}</div>
  </div>`;
}
async function loadDraft(x) {
  if (!ST.drafts[x.id]) ST.drafts[x.id] = (await api("GET", `/orgs/${ST.org.id}/ideas/${x.id}/proposal`)).proposal;
  return ST.drafts[x.id];
}
// Writes the parts still missing, one request at a time. A per-minute limit of the free AI tier is waited out (up to four
// times per part); any other error stops the run, and the written parts stay stored.
async function writeMissing(card, x, tpl, d) {
  tpl = tplOf(d) || tpl;
  const msg = card.querySelector("[data-appmsg]"), units = unitsOf(tpl, d.plan, d.facts.lang);
  const todo = units.filter((u) => !(d.sections[u.key] && d.sections[u.key].text));
  let i = units.length - todo.length;
  for (const u of todo) {
    i++;
    for (let attempt = 0; ; attempt++) {
      opState(msg, "generating", T("app.writing", i, units.length, unitTitle(u, d)), (100 * (i - 1)) / units.length);
      try {
        const r = await api("POST", `/orgs/${ST.org.id}/ideas/${x.id}/proposal/section`, { key: u.key });
        d.sections[u.key] = r.section; x.proposal = { ...(x.proposal || {}), v: 2, written: Object.values(d.sections).filter((s) => s && s.text).length };
        break;
      } catch (e) {
        if (e.message === "ai_busy" && attempt < 4) {
          for (let s = 30; s > 0; s -= 5) { opState(msg, "generating", T("app.busyWait", s), (100 * (i - 1)) / units.length); await sleep(5000); }
          continue;
        }
        opState(msg, "failed", errText(e) + " " + T("app.stopped"));
        return false;
      }
    }
  }
  opState(msg, "completed", T("app.done"));
  return true;
}
function drawApp(card, x, tpl) {
  const body = card.querySelector("[data-appbody]"), d = ST.drafts[x.id];
  tpl = (d && tplOf(d)) || tpl;
  body.innerHTML = ST.appOpen.has(x.id) && d ? viewerHTML(x, tpl, d) : "";
  const ob = card.querySelector('[data-act="appopen"]');
  if (ob) { ob.textContent = T(ST.appOpen.has(x.id) ? "app.hide" : "app.open"); ob.setAttribute("aria-expanded", String(ST.appOpen.has(x.id))); }
  const pw = card.querySelector('[data-act="appopen"] + .fine'); if (pw && d) pw.textContent = T("app.partsWritten", Object.values(d.sections).filter((s) => s && s.text).length);
  if (!d || !ST.appOpen.has(x.id)) return;
  const pdfMsg = card.querySelector("[data-pdfmsg]");
  const dl = async (kind) => {
    opState(pdfMsg, "drawing", "");
    try { await (kind === "docx" ? downloadDocx(d) : downloadAppPdf(d)); opState(pdfMsg, "completed", ""); } catch (e) { opState(pdfMsg, "failed", (e && e.status ? errText(e) : T("pdfFail"))); }
  };
  body.querySelector('[data-act="apppdf"]').addEventListener("click", () => dl("pdf"));
  body.querySelector('[data-act="appdocx"]').addEventListener("click", () => dl("docx"));
  const cont = body.querySelector('[data-act="appcont"]');
  if (cont) cont.addEventListener("click", async () => { cont.disabled = true; await writeMissing(card, x, tpl, d); drawApp(card, x, tpl); });
  body.querySelectorAll(".app-unit").forEach((det) => {
    const key = det.dataset.unit, u = unitsOf(tpl, d.plan, d.facts.lang).find((y) => y.key === key), um = det.querySelector("[data-umsg]");
    const redraw = () => { const n = document.createElement("div"); n.innerHTML = unitHTML(u, d, tpl, premium() && canEdit()); const fresh = n.firstElementChild; fresh.open = true; det.replaceWith(fresh); drawApp(card, x, tpl); const again = card.querySelector(`.app-unit[data-unit="${CSS.escape(key)}"]`); if (again) again.open = true; };
    const copy = async (t) => { try { await navigator.clipboard.writeText(t); um.textContent = T("app.copied"); } catch { um.textContent = ""; } };
    det.querySelectorAll("[data-copy]").forEach((b) => b.addEventListener("click", () => copy((d.sections[key].answers || {})[b.dataset.copy] || "")));
    const on = (a, fn) => { const b = det.querySelector(`[data-uact="${a}"]`); if (b) b.addEventListener("click", fn); };
    on("copy", () => copy(d.sections[key].text));
    on("rewrite", async (ev) => {
      const s = d.sections[key];
      if (s && s.text && !confirm(T("app.rewriteWarn"))) return;
      ev.currentTarget.disabled = true; opState(um, "generating", unitTitle(u, d));
      try { d.sections[key] = (await api("POST", `/orgs/${ST.org.id}/ideas/${x.id}/proposal/section`, { key, fresh: !!(s && s.text) })).section; redraw(); }
      catch (e) { opState(um, "failed", errText(e)); ev.currentTarget.disabled = false; }
    });
    on("edit", () => {
      const s = d.sections[key];
      if (tpl.kind === "form") det.querySelectorAll(".a[data-q]").forEach((a) => { a.innerHTML = `<textarea rows="8" data-qedit="${esc(a.dataset.q)}">${esc((s.answers || {})[a.dataset.q] || "")}</textarea>`; });
      else det.querySelector(".a").innerHTML = `<textarea rows="18" data-tedit>${esc(s.text)}</textarea>`;
      const row = det.querySelector('[data-uact="edit"]').parentElement;
      row.innerHTML = `<button type="button" class="btn" data-uact="save">${esc(T("app.save"))}</button><button type="button" class="btn ghost" data-uact="cancel">${esc(T("app.cancel"))}</button><span class="fine" data-umsg role="status"></span>`;
      row.querySelector('[data-uact="cancel"]').addEventListener("click", redraw);
      row.querySelector('[data-uact="save"]').addEventListener("click", async (ev) => {
        const body = tpl.kind === "form" ? { key, answers: Object.fromEntries([...det.querySelectorAll("[data-qedit]")].map((t) => [t.dataset.qedit, t.value])) } : { key, text: det.querySelector("[data-tedit]").value };
        ev.currentTarget.disabled = true;
        try { d.sections[key] = (await api("PATCH", `/orgs/${ST.org.id}/ideas/${x.id}/proposal`, body)).section; redraw(); }
        catch (e) { row.querySelector("[data-umsg]").textContent = errText(e); ev.currentTarget.disabled = false; }
      });
    });
  });
}
function bindApp(card, x) {
  const tpl = appTpl(x), box = card.querySelector("[data-app]");
  if (!tpl || !box) return;
  const body = box.querySelector("[data-appbody]"), msg = box.querySelector("[data-appmsg]");
  const showForm = (prev) => {
    body.innerHTML = factsForm(x, tpl, prev);
    const form = body.querySelector("[data-appform]");
    body.querySelector('[data-act="appcancel"]').addEventListener("click", () => { body.innerHTML = ""; drawApp(card, x, tpl); });
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = form.querySelector('[type="submit"]'); btn.disabled = true;
      opState(msg, "generating", T("app.planning"));
      try {
        const r = await api("POST", `/orgs/${ST.org.id}/ideas/${x.id}/proposal`, { facts: readFacts(form), lang: L() });
        ST.drafts[x.id] = r.proposal; x.proposal = { v: 2, at: r.proposal.at, template: r.proposal.template, written: 0 };
        ST.appOpen.add(x.id);
        const head = box.querySelector('[data-act="appstart"]');
        if (head) head.outerHTML = `<button type="button" class="btn pdf" data-act="appopen" aria-expanded="true">${esc(T("app.hide"))}</button><span class="fine">${esc(T("app.partsWritten", 0))}</span>`;
        bindOpen();
        body.innerHTML = "";
        await writeMissing(card, x, tpl, ST.drafts[x.id]);
        drawApp(card, x, tpl);
      } catch (e) { opState(msg, "failed", errText(e)); btn.disabled = false; }
    });
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const start = box.querySelector('[data-act="appstart"]');
  if (start) start.addEventListener("click", () => showForm(null));
  const again = box.querySelector('[data-act="appagain"]');
  if (again) again.addEventListener("click", async () => {
    if (!confirm(T("app.againWarn"))) return;
    try { const d = await loadDraft(x); ST.appOpen.delete(x.id); drawApp(card, x, tpl); showForm(d.facts); } catch (e) { opState(msg, "failed", errText(e)); }
  });
  const bindOpen = () => {
    const ob = box.querySelector('[data-act="appopen"]');
    if (!ob || ob._bound) return; ob._bound = true;
    ob.addEventListener("click", async () => {
      if (ST.appOpen.has(x.id)) { ST.appOpen.delete(x.id); drawApp(card, x, tpl); return; }
      opState(msg, "reading", "");
      try { await loadDraft(x); ST.appOpen.add(x.id); opState(msg, "idle"); drawApp(card, x, tpl); } catch (e) { opState(msg, "failed", errText(e)); }
    });
  };
  bindOpen();
  if (ST.appOpen.has(x.id) && ST.drafts[x.id]) drawApp(card, x, tpl);
}

// Lines of one text block: "- " lines become a list, the rest stay paragraphs.
function textParts(t) {
  const out = []; let list = null, brk = true;
  for (const line of String(t || "").split("\n")) {
    const m = line.match(/^\s*[-•]\s+(.*)$/);
    if (m) { if (!list) out.push((list = { ul: [] })); list.ul.push(m[1]); brk = true; }
    else if (!line.trim()) { list = null; brk = true; }
    else { list = null; const last = out[out.length - 1]; if (!brk && last && last.p !== undefined) last.p += " " + line.trim(); else out.push({ p: line.trim() }); brk = false; }
  }
  return out;
}
const ganttCols = (months) => (months > 36 ? Array.from({ length: Math.ceil(months / 3) }, (_, i) => ({ label: "Q" + (i + 1), from: i * 3 + 1, to: i * 3 + 3 })) : Array.from({ length: months }, (_, i) => ({ label: String(i + 1), from: i + 1, to: i + 1 })));
function appPdfDoc(d) {
  const L2 = docL(d.facts.lang), model = documentModel(d, L2), content = [];
  for (const b of model) {
    if (b.h === 1) content.push({ text: b.text, style: "h1" });
    else if (b.h === 2) content.push({ text: b.text, style: "h2" });
    else if (b.h === 3) content.push({ text: b.text, style: "h3" });
    else if (b.h === 4) content.push({ text: b.text, bold: true, margin: [0, 4, 0, 2] });
    else if (b.meta) content.push({ text: b.meta.join("\n"), style: "meta" });
    else if (b.note) content.push({ text: b.note, style: "note" });
    else if (b.p !== undefined) for (const x of textParts(b.p)) content.push(x.ul ? { ul: x.ul, margin: [0, 0, 0, 6] } : { text: x.p, margin: [0, 0, 0, 6], bold: !!b.bold, italics: !!b.missing, color: b.missing ? "#777" : undefined });
    else if (b.qa !== undefined) {
      content.push({ text: b.qa, style: "q" });
      if (b.text) for (const x of textParts(b.text)) content.push(x.ul ? { ul: x.ul, margin: [0, 0, 0, 4] } : { text: x.p, margin: [0, 0, 0, 4] });
      else content.push({ text: L2.tbc, italics: true, color: "#777" });
      content.push({ text: `${fmtInt(String(b.text || "").length, d.facts.lang)} ${L2.characters}`, style: "small", margin: [0, 0, 0, 8] });
    } else if (b.table) {
      const cell = (c) => (c && typeof c === "object" ? { text: String(c.text ?? ""), colSpan: c.colSpan } : String(c ?? ""));
      const rows = b.table.rows.map((r) => r.map((c, i) => (c === "" && i > 0 && r.slice(0, i).some((y) => y && y.colSpan && r.indexOf(y) + y.colSpan > i) ? {} : cell(c))));
      content.push({ table: { headerRows: 1, widths: b.table.widths, body: [b.table.head.map((h) => ({ text: h, style: "th" })), ...rows] }, layout: "lightHorizontalLines", fontSize: 8, margin: [0, 2, 0, 8] });
    } else if (b.gantt) {
      const cols = ganttCols(b.gantt.months);
      content.push({ table: { headerRows: 1, widths: [34, ...cols.map(() => "*")], body: [[{ text: "", style: "th" }, ...cols.map((c) => ({ text: c.label, fontSize: 5, alignment: "center" }))],
        ...b.gantt.rows.map((r) => [{ text: r.label, fontSize: 7, bold: true }, ...cols.map((c) => (c.to >= r.start && c.from <= r.end ? { text: "", fillColor: "#1f4e79" } : { text: "" }))])] }, layout: { hLineWidth: () => 0.3, vLineWidth: () => 0.3, hLineColor: () => "#ccc", vLineColor: () => "#ccc" }, margin: [0, 2, 0, 8] });
    }
  }
  return { info: { title: (d.plan && d.plan.title) || "Application", creator: "Eligible Calls" }, pageSize: "A4", pageMargins: [45, 50, 45, 50], content,
    footer: (cur, tot) => ({ columns: [{ text: "Eligible Calls · " + L2.footer, fontSize: 7, color: "#888" }, { text: `${cur} / ${tot}`, alignment: "right", fontSize: 7, color: "#888" }], margin: [45, 18, 45, 0] }),
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.2 },
    styles: { h1: { fontSize: 17, bold: true, margin: [0, 0, 0, 6] }, h2: { fontSize: 13, bold: true, color: "#1f4e79", margin: [0, 12, 0, 5] }, h3: { fontSize: 11, bold: true, margin: [0, 8, 0, 3] },
      meta: { fontSize: 9, color: "#444", margin: [0, 0, 0, 6] }, note: { fontSize: 8, italics: true, color: "#555", margin: [0, 2, 0, 8] }, q: { fontSize: 9, bold: true, color: "#333", margin: [0, 6, 0, 2] }, small: { fontSize: 7.5, color: "#777" }, th: { bold: true, fontSize: 8 } } };
}
const appFile = (d, ext) => fileSafe((d.plan && (d.plan.acronym || d.plan.title)) || "application") + "-" + (d.template || "app") + "." + ext;
async function downloadAppPdf(d) {
  const pm = await loadPdfMake();
  await new Promise((res, rej) => { try { pm.createPdf(appPdfDoc(d)).download(appFile(d, "pdf"), res); } catch (e) { rej(e); } });
}
async function downloadDocx(d) {
  if (!window.docx) await EC.loadScript(DOCXJS);
  const X = window.docx, L2 = docL(d.facts.lang), model = documentModel(d, L2), kids = [];
  const P = (text, o = {}) => new X.Paragraph({ children: [new X.TextRun({ text: String(text ?? ""), bold: o.bold, italics: o.italics, size: o.size, color: o.color })], spacing: { after: o.after ?? 120 }, heading: o.heading });
  const pushText = (t) => { for (const x of textParts(t)) { if (x.ul) x.ul.forEach((li) => kids.push(new X.Paragraph({ text: li, bullet: { level: 0 } }))); else kids.push(P(x.p)); } };
  const tCell = (c, o = {}) => new X.TableCell({ children: [P(c && typeof c === "object" ? c.text : c, { size: 18, bold: o.bold, after: 40 })], columnSpan: c && typeof c === "object" && c.colSpan ? c.colSpan : undefined, shading: o.fill ? { fill: o.fill } : undefined });
  for (const b of model) {
    if (b.h) kids.push(P(b.text, { heading: [null, X.HeadingLevel.TITLE, X.HeadingLevel.HEADING_1, X.HeadingLevel.HEADING_2, X.HeadingLevel.HEADING_3][b.h], after: 120 }));
    else if (b.meta) b.meta.forEach((m) => kids.push(P(m, { size: 18, color: "444444", after: 40 })));
    else if (b.note) kids.push(P(b.note, { italics: true, size: 18, color: "555555" }));
    else if (b.p !== undefined) { if (b.missing) kids.push(P(b.p, { italics: true, color: "777777" })); else if (b.bold) kids.push(P(b.p, { bold: true })); else pushText(b.p); }
    else if (b.qa !== undefined) {
      kids.push(P(b.qa, { bold: true, size: 20, color: "333333", after: 60 }));
      if (b.text) pushText(b.text); else kids.push(P(L2.tbc, { italics: true, color: "777777" }));
      kids.push(P(`${fmtInt(String(b.text || "").length, d.facts.lang)} ${L2.characters}`, { size: 16, color: "777777", after: 200 }));
    } else if (b.table) {
      const rows = [new X.TableRow({ tableHeader: true, children: b.table.head.map((h) => tCell(h, { bold: true, fill: "E8EEF5" })) })];
      for (const r of b.table.rows) { const cells = []; let skip = 0; for (const c of r) { if (skip) { skip--; continue; } if (c && typeof c === "object" && c.colSpan) skip = c.colSpan - 1; cells.push(tCell(c)); } rows.push(new X.TableRow({ children: cells })); }
      kids.push(new X.Table({ rows, width: { size: 100, type: X.WidthType.PERCENTAGE } }), P(""));
    } else if (b.gantt) {
      const cols = ganttCols(b.gantt.months);
      const rows = [new X.TableRow({ children: [tCell(""), ...cols.map((c) => tCell(c.label, { bold: true }))] }), ...b.gantt.rows.map((r) => new X.TableRow({ children: [tCell(r.label, { bold: true }), ...cols.map((c) => tCell("", c.to >= r.start && c.from <= r.end ? { fill: "1F4E79" } : {}))] }))];
      kids.push(new X.Table({ rows, width: { size: 100, type: X.WidthType.PERCENTAGE } }), P(""));
    }
  }
  const doc = new X.Document({ creator: "Eligible Calls", title: (d.plan && d.plan.title) || "Application", styles: { default: { document: { run: { font: "Calibri", size: 22 } } } }, sections: [{ children: kids }] });
  const blob = await X.Packer.toBlob(doc);
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = appFile(d, "docx"); document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
// Premium access card: what the user can do now, how to ask for access, and where the request stands.
function paywallHTML(a, set) {
  if (!a || a.active) return a && a.active && a.request && a.request.expiresAt ? `<p class="fine">${esc(T("premiumUntil", fmtTime(a.request.expiresAt)))}</p>` : "";
  const st = a.status, rq = a.request;
  const plans = (set && set.plans) || [];
  const open = st === "pending_payment" || st === "payment_submitted";
  let body = "";
  if (st === "payment_submitted") body = `<p class="note ok">${esc(T("pwPaid", fmtTime(rq.paidAt || rq.updatedAt)))}</p>`;
  else if (st === "pending_payment") body = `<p class="note">${esc(T("pwSent", fmtTime(rq.requestedAt)))}</p>
      ${set.paymentInstructions ? `<div class="pw-pay"><h3>${esc(T("pwHowPay"))}</h3><p>${esc(set.paymentInstructions)}</p></div>` : `<p class="fine">${esc(T("pwNoInstructions"))}</p>`}
      <form class="oi-row" id="pwPaid"><div class="fld"><label for="pwRef">${esc(T("pwRef"))}</label><input type="text" id="pwRef" maxlength="200"></div><button class="btn" type="submit">${esc(T("pwPaidBtn"))}</button></form>`;
  else body = `${["rejected", "revoked", "expired"].includes(st) ? `<p class="note warn">${esc(T("pwStatus." + st))}${rq && rq.adminNote ? ": " + esc(rq.adminNote) : ""}</p>` : ""}
      <div class="pw-plans">${plans.map((pl, i) => `<label class="pw-plan"><input type="radio" name="pwPlan" value="${esc(pl.id)}"${i === 0 ? " checked" : ""}><span><b>${esc(pl.name)}</b>${pl.price ? ` · ${esc(pl.price)}` : ""}${pl.description ? `<span class="fine">${esc(pl.description)}</span>` : ""}</span></label>`).join("")}</div>
      <div class="oi-row"><button class="btn" type="button" id="pwAsk">${esc(T("pwAsk"))}</button></div>`;
  return `<section class="oi-card paywall" id="oiPaywall"><h2>${esc(T(a.freeLeft > 0 ? "pwTitleFree" : "pwTitle"))}</h2>
    <p>${esc(a.freeLeft > 0 ? T("pwFreeLeft", a.freeLeft) : T("pwLede"))}</p>${open || a.freeLeft === 0 || ["rejected", "revoked", "expired"].includes(st) ? body : `<details><summary>${esc(T("pwAskEarly"))}</summary>${body}</details>`}
    <div role="status" id="pwMsg"></div></section>`;
}
async function secIdeas(arg) {
  const org = ST.org, p = org.profile;
  let ideas = []; try { ideas = (await api("GET", `/orgs/${org.id}/ideas`)).ideas; } catch { /* shown empty */ }
  try { const a = await api("GET", "/access"); ST.me.access = a; ST.accessSet = a.settings; } catch { /* keeps the access from /me */ }
  const acc = ST.me.access || { active: false, freeLeft: 0, status: "none" };
  const canGen = acc.active || acc.freeLeft > 0;
  ST.ideas = ideas;
  try { await loadCriteria(); if (ideas.some((x) => erasmusAction(x.callId))) await loadGuide(); } catch { /* the evaluation box says the criteria are unavailable */ }
  await loadFormsIdx();
  ST.compare = new Set([...(ST.compare || [])].filter((id) => ideas.some((x) => x.id === id)));
  const res = results(), cands = ideaCandidates();
  // Keep the member's choice while it still matches the shortlist; otherwise start from the most compatible calls.
  // Calls whose ideas were all evaluated below a threshold are not ticked by default; they can still be chosen.
  const okCalls = new Set(ideas.filter((x) => !belowThreshold(x)).map((x) => x.callId));
  const weak = new Set(ideas.filter(belowThreshold).map((x) => x.callId).filter((c) => !okCalls.has(c)));
  const keep = ST.ideaPick && ST.ideaPickOrg === org.id ? [...ST.ideaPick].filter((id) => cands.some((r) => r.callId === id)) : [];
  ST.ideaPick = new Set(keep.length ? keep : cands.filter((r) => !weak.has(r.callId)).slice(0, IDEA_CALLS).map((r) => r.callId)); ST.ideaPickOrg = org.id;
  const saved = ideas.filter((x) => x.status === "saved"), rest = ideas.filter((x) => x.status !== "saved").sort((a, b) => a.rank - b.rank);
  const below = rest.filter(belowThreshold), sugg = rest.filter((x) => !belowThreshold(x));
  const ready = ideaReady(p);
  return `<h1>${esc(T("ideasTitle"))}</h1><p class="lede">${esc(T("ideasLede"))}</p>
    ${!canEdit() ? `<p class="note">${esc(T("ideasViewerNote"))}</p>` : ""}
    ${canEdit() ? `<section class="oi-card"><h2>${esc(T("ideasPick"))}</h2>
      ${!ready ? `<p class="note warn">${esc(T("ideasNeed"))} <a href="#org/${org.id}/profile">${esc(T("fillProfile"))}</a></p>` : ""}
      ${cands.length ? `<p class="fine">${esc(T("ideasPickNote", IDEA_CALLS))}</p><div class="idea-picks">${cands.map((r) => `<label class="opt"><input type="checkbox" data-pick="${esc(r.callId)}"${ST.ideaPick.has(r.callId) ? " checked" : ""}><span>${esc(r.call.title)} <span class="fine">· ${esc((EC.P[r.call.programme] || {}).short || r.call.programme)}</span>${weak.has(r.callId) ? ` <span class="fine warn">· ${esc(T("pickBelow"))}</span>` : ""}</span>${scoreNum(r.score)}</label>`).join("")}</div>
        <div class="oi-row"><button type="button" class="btn" id="oiGen"${ready && ST.ideaPick.size && canGen ? "" : " disabled"}>${esc(T(ideas.length ? "ideasRegenerate" : "ideasGenerate"))}</button><span class="fine">${esc(T("ideasUse"))}</span></div><div id="oiGenMsg" role="status"></div><div id="oiEvalMsg" role="status"></div>`
        : `<p class="note">${esc(T("ideasNoCalls"))} <a href="#org/${org.id}/matching/all">${esc(T("openMatching"))} →</a></p>`}</section>` : ""}
    ${canEdit() ? paywallHTML(acc, ST.accessSet) : ""}
    ${ideas.length >= 2 ? `<section class="oi-card"><h2>${esc(T("compareTitle"))}</h2><div id="oiCmp">${compareHTML(ideas, res)}</div></section>` : ""}
    ${saved.length ? `<h2 class="idea-h" id="oiSaved">${esc(T("ideasSaved"))} (${saved.length})</h2><div class="match-list">${saved.map((x) => ideaCard(x, res)).join("")}</div>` : ""}
    ${sugg.length || !below.length ? `<h2 class="idea-h">${esc(T("ideasSuggested"))}</h2>${sugg.length ? `<div class="match-list">${sugg.map((x) => ideaCard(x, res)).join("")}</div>` : `<p class="fine">${esc(T("ideasNone"))}</p>`}` : ""}
    ${below.length ? `<h2 class="idea-h" id="oiBelow">${esc(T("ideasBelow"))} (${below.length})</h2><p class="fine">${esc(T("ideasBelowNote"))}</p><div class="match-list">${below.map((x) => ideaCard(x, res)).join("")}</div>` : ""}`;
}
// Revises an idea that was evaluated below the threshold (the server uses that evaluation), then evaluates the new text.
async function improveIdea(x, m) {
  opState(m, "analysing", T("improveBusy"));
  const r = await api("POST", `/orgs/${ST.org.id}/ideas/${x.id}/improve`, { lang: L() });
  Object.assign(x, r.idea);
  opState(m, "analysing", T("evBusy"));
  return runEvaluation(x);
}
// One evaluation request; the result is kept on the idea and shown as the selected evaluation.
async function runEvaluation(x) {
  const r = await api("POST", `/orgs/${ST.org.id}/ideas/${x.id}/evaluate`, { lang: L() });
  x.evaluations = { ...(x.evaluations || {}), [r.evaluation.key]: r.evaluation }; ST.evalSel[x.id] = r.evaluation.key;
  r.evaluation._cached = !!r.cached;
  return r.evaluation;
}
// Evaluates newly generated ideas one after another as soon as they are shown, so nobody has to press "Evaluate".
// Each request counts against the same AI limits as a manual evaluation. A missing rubric or one unusable answer
// skips that idea; a limit, the paywall or an unavailable model stops the run. The results are stored on the server,
// so leaving the page keeps what was done.
const AUTO_EVAL_STOP = new Set([402, 403, 429, 503, 0]);
// Only the best-ranked new ideas are evaluated by themselves; the others have the Evaluate button. Each evaluation is one
// model request, and every idea generation already uses one request per call.
const AUTO_EVAL_MAX = 3;
async function autoEvaluate(ids) {
  const box = document.getElementById("oiEvalMsg"), route = location.hash;
  const all = ids.map((id) => (ST.ideas || []).find((x) => x.id === id)).filter((x) => { const rb = x && ideaRubric(x); return rb && !(x.evaluations || {})[rb.key]; });
  const todo = all.slice(0, AUTO_EVAL_MAX), left = all.length - todo.length;
  if (!todo.length) { if (box && ids.length) { box.className = "note"; box.textContent = T("evAutoNone"); } return; }
  let done = 0, below = 0, stop = null, revised = 0, lifted = 0, next = 0, finished = 0;
  const progress = () => opState(box, "analysing", `${T("evBusy")} (${T("evAuto", Math.min(finished + 1, todo.length), todo.length)})`, (100 * finished) / todo.length);
  progress();
  // Two ideas at a time: each evaluation is one model request, and the two Groq models have separate per-minute limits.
  const worker = async () => {
    while (!stop && next < todo.length) {
      const x = todo[next++], card = document.querySelector(`article.idea[data-idea="${CSS.escape(x.id)}"]`);
      const cm = card && card.querySelector("[data-evmsg]"), cb = card && card.querySelector('[data-act="evaluate"]');
      if (cb) cb.disabled = true; opState(cm, "analysing", T("evBusy"));
      try {
        let e = await runEvaluation(x);
        // Below the threshold: revised once with that evaluation and evaluated again. Two more AI actions, only for ideas
        // that would otherwise not be worth offering.
        if (e.passed === false && !(x.idea.revisions > 0)) { e = await improveIdea(x, cm); revised++; if (e.passed !== false) lifted++; }
        done++; if (e.passed === false) below++; opState(cm, "completed", T("evDone"));
      }
      catch (err) { opState(cm, "failed", errText(err)); if (cb) cb.disabled = false; if (AUTO_EVAL_STOP.has(err && err.status)) stop = err; }
      finished++; if (!stop) progress();
    }
  };
  await Promise.all([worker(), worker()]);
  ST.evalNote = { ok: !stop, text: (done ? T("evAutoDone", done, below) : "") + (revised ? " " + T("evAutoRevised", revised, lifted) : "") + (stop ? (done ? " " : "") + T("evAutoStop") + " " + errText(stop) : "") + (left && !stop ? (done ? " " : "") + T("evAutoMore", left) : "") };
  if (location.hash === route) { ST.ideaNote = ST.lastIdeaNote || null; refresh(); }   // regroup the ideas: below-threshold concepts move to their own section
}
// Evaluation box of one idea card: switch between stored evaluations, run a new one, redraw in place.
function bindEval(card, x) {
  const org = ST.org, id = x.id, box = card.querySelector(".ev-box"); if (!box) return;
  const sel = box.querySelector("[data-evsel]"), btn = box.querySelector('[data-act="evaluate"]'), m = box.querySelector("[data-evmsg]");
  const redraw = () => { const open = box.open; const nb = document.createElement("div"); nb.innerHTML = evalBox(x); const fresh = nb.firstElementChild; fresh.open = open || !!(x.evaluations || {})[ST.evalSel[id]]; box.replaceWith(fresh); bindEval(card, x); };
  if (sel) sel.addEventListener("change", () => { ST.evalSel[id] = sel.value; redraw(); });
  if (btn) btn.addEventListener("click", async () => {
    btn.disabled = true; opState(m, "analysing", T("evBusy"));
    try {
      const ev = await runEvaluation(x); redraw();
      const nm = card.querySelector("[data-evmsg]"); if (nm) { nm.className = "fine ok"; nm.textContent = T(ev._cached ? "evSame" : "evDone"); }
    } catch (e) { opState(m, "failed", errText(e)); btn.disabled = false; }
  });
}
afterRender.ideas = (arg) => {
  const org = ST.org;
  document.querySelectorAll('[data-act="explain"]').forEach((b) => b.addEventListener("click", async () => {
    const card = b.closest("[data-idea]"), x = (ST.ideas || []).find((i) => i.id === card.dataset.idea), m = card.querySelector("[data-exmsg]");
    b.disabled = true; opState(m, "analysing");
    try {
      const r = await api("POST", `/orgs/${org.id}/ideas/${x.id}/fit-explanation`, { lang: L() });
      if (r.idea) Object.assign(x, r.idea); else x.idea.fit = { ...(x.idea.fit || {}), explanation: r.explanation };
      refresh();
    } catch (e) { opState(m, "failed", errText(e)); b.disabled = false; }
  }));
  document.querySelectorAll("[data-pick]").forEach((cb) => cb.addEventListener("change", () => {
    if (cb.checked && ST.ideaPick.size >= IDEA_CALLS) { cb.checked = false; return; }
    cb.checked ? ST.ideaPick.add(cb.dataset.pick) : ST.ideaPick.delete(cb.dataset.pick);
    const g = document.getElementById("oiGen"); if (g) g.disabled = !ST.ideaPick.size || !ideaReady(org.profile);
  }));
  const gen = document.getElementById("oiGen");
  if (gen) gen.addEventListener("click", async () => {
    const msg = document.getElementById("oiGenMsg");
    const cands = ideaCandidates().filter((r) => ST.ideaPick.has(r.callId)).map((r) => ({ id: r.callId, score: r.score, status: r.status, band: r.band }));
    gen.disabled = true; opState(msg, "generating", T("ideasBusy"));
    msg.insertAdjacentHTML("afterend", ideaSkeletons(cands.length));
    const skel = msg.nextElementSibling;
    try {
      const r = await api("POST", `/orgs/${org.id}/ideas`, { candidates: cands, lang: L() });
      const miss = (r.missing || []).map((x) => ({ title: x.title || x.callId, why: T("ideaWhy." + x.why) }));
      ST.ideaNote = { ok: r.generated > 0 && !miss.length, text: r.generated ? T("ideasDone", r.generated, cands.length - miss.length) : T("ideasZero"), miss };
      await loadMe(true);
      const fresh = (r.ideas || []).filter((x) => x.batchId === r.batchId).map((x) => x.id);
      ST.lastIdeaNote = null;
      if (fresh.length && premium()) ST.autoEval = fresh;
      else if (fresh.length) ST.evalNote = { ok: true, text: T("evAutoPremium") };
      refresh();
    } catch (e) { gen.disabled = false; opState(msg, "failed", errText(e)); }
    finally { if (skel && skel.classList.contains("skel-list")) skel.remove(); }
  });
  if (ST.ideaNote) {
    const m = document.getElementById("oiGenMsg"), n = ST.ideaNote;
    ST.lastIdeaNote = n;
    if (m) {
      m.className = n.ok ? "note ok" : "note warn";
      m.innerHTML = `<p>${esc(n.text)}</p>` + (n.miss.length ? `<p>${esc(T("ideasMissing"))}</p><ul>${n.miss.map((x) => `<li><b>${esc(x.title)}</b>: ${esc(x.why)}</li>`).join("")}</ul><p class="fine">${esc(T("ideasRetry"))}</p>` : "");
    }
    ST.ideaNote = null;
  }
  const pwMsg = document.getElementById("pwMsg");
  const pwDo = async (path, body) => {
    opState(pwMsg, "saving");
    try { const a = await api("POST", path, body); ST.me.access = a; ST.pwNote = T(path.endsWith("payment") ? "pwPaidDone" : "pwAskDone"); refresh(); }
    catch (e) { pwMsg.className = "note err"; pwMsg.textContent = errText(e); }
  };
  const ask = document.getElementById("pwAsk");
  if (ask) ask.addEventListener("click", () => { const pl = document.querySelector('input[name="pwPlan"]:checked'); pwDo("/access/request", { plan: pl ? pl.value : undefined, orgId: org.id }); });
  const paid = document.getElementById("pwPaid");
  if (paid) paid.addEventListener("submit", (ev) => { ev.preventDefault(); pwDo("/access/payment", { reference: document.getElementById("pwRef").value }); });
  if (ST.pwNote && pwMsg) { pwMsg.className = "note ok"; pwMsg.textContent = ST.pwNote; ST.pwNote = null; }
  document.querySelectorAll("[data-pw]").forEach((a) => a.addEventListener("click", (ev) => { ev.preventDefault(); const c = document.getElementById("oiPaywall"); if (c) { c.querySelectorAll("details").forEach((d) => (d.open = true)); c.scrollIntoView({ behavior: "smooth", block: "start" }); } }));
  if (arg === "saved") { const h = document.getElementById("oiSaved") || document.querySelector(".idea-h"); if (h) h.scrollIntoView({ block: "start" }); }
  document.querySelectorAll("article.idea").forEach((card) => {
    const id = card.dataset.idea, x = ST.ideas.find((y) => y.id === id), msg = card.querySelector("[data-msg]");
    const on = (act, ev, fn) => { const el = card.querySelector(`[data-act="${act}"]`); if (el) el.addEventListener(ev, fn); };
    on("save", "click", async () => { try { await api("PATCH", `/orgs/${org.id}/ideas/${id}`, { status: x.status === "saved" ? "suggested" : "saved" }); refresh(); } catch (e) { msg.textContent = errText(e); } });
    on("notes", "click", async () => { try { const v = card.querySelector("textarea").value; await api("PATCH", `/orgs/${org.id}/ideas/${id}`, { notes: v }); x.notes = v; msg.textContent = T("ideaNotesSaved"); const cmp = document.getElementById("oiCmp"); if (cmp) cmp.innerHTML = compareHTML(ST.ideas, results()); } catch (e) { msg.textContent = errText(e); } });
    on("del", "click", async () => { try { await api("DELETE", `/orgs/${org.id}/ideas/${id}`); ST.compare.delete(id); refresh(); } catch (e) { msg.textContent = errText(e); } });
    const pdfMsg = card.querySelector("[data-pdfmsg]");
    const makePdf = async (fresh, btn) => {
      btn.disabled = true; opState(pdfMsg, fresh || !x.proposal ? "generating" : "drawing", T(fresh || !x.proposal ? "pdfBusy" : "pdfDrawing"));
      try {
        let p;
        if (fresh || !x.proposal) { p = (await api("POST", `/orgs/${org.id}/ideas/${id}/proposal`, { lang: L() })).proposal; x.proposal = { at: p.at, model: p.model, lang: p.lang }; opState(pdfMsg, "drawing", T("pdfDrawing")); }
        else p = (await api("GET", `/orgs/${org.id}/ideas/${id}/proposal`)).proposal;
        await downloadProposal(x, p);
        opState(pdfMsg, "completed", T("pdfDone"));
        const b = card.querySelector('[data-act="pdf"]'); if (b) b.lastChild.textContent = " " + T("pdfDownload");
        if (!card.querySelector('[data-act="pdfnew"]') && canEdit()) { const r = document.createElement("button"); r.type = "button"; r.className = "linkbtn"; r.dataset.act = "pdfnew"; r.textContent = T("pdfRegenerate"); pdfMsg.before(r); r.addEventListener("click", () => makePdf(true, r)); }
      } catch (e) { opState(pdfMsg, "failed", e && e.status ? errText(e) : T("pdfFail")); }
      btn.disabled = false;
    };
    on("pdf", "click", (ev) => makePdf(false, ev.currentTarget));
    on("pdfnew", "click", (ev) => makePdf(true, ev.currentTarget));
    bindEval(card, x);
    bindApp(card, x);
    on("improve", "click", async (ev) => {
      const b = ev.currentTarget, m = card.querySelector("[data-immsg]"); b.disabled = true;
      try { await improveIdea(x, m); refresh(); } catch (e) { opState(m, "failed", errText(e)); b.disabled = false; }
    });
    on("translate", "click", async (ev) => {
      const b = ev.currentTarget, m = card.querySelector("[data-trmsg]"); b.disabled = true; opState(m, "analysing", T("trBusy"));
      try { Object.assign(x, (await api("POST", `/orgs/${org.id}/ideas/${id}/translate`, { lang: L() })).idea); refresh(); } catch (e) { opState(m, "failed", errText(e)); b.disabled = false; }
    });
    on("compare", "change", (ev) => {
      if (ev.target.checked && ST.compare.size >= 3) { ev.target.checked = false; if (msg) msg.textContent = T("compareMax"); return; }
      ev.target.checked ? ST.compare.add(id) : ST.compare.delete(id);
      const cmp = document.getElementById("oiCmp"); if (cmp) cmp.innerHTML = compareHTML(ST.ideas, results());
    });
  });
  const evMsg = document.getElementById("oiEvalMsg");
  if (ST.evalNote && evMsg && ST.evalNote.text) { evMsg.className = ST.evalNote.ok ? "note ok" : "note warn"; evMsg.textContent = ST.evalNote.text; }
  ST.evalNote = null;
  if (ST.autoEval && canEdit()) { const ids = ST.autoEval; ST.autoEval = null; autoEvaluate(ids); }
  else autoTranslate();
};
/* ---------- saved reports ---------- */
// The live assessment of a saved report's call, if the call is still published.
const liveOf = (key) => { const c = EC.BYKEY[key]; return c ? assess(matchProfile(), c, assessOpts()) : null; };
function reportDoc(rep) {
  const d = rep.data, a = d.assessment, c = d.call;
  const ul = (xs) => (xs.length ? { ul: xs, margin: [0, 0, 0, 6] } : { text: T("none"), italics: true, color: "#777", margin: [0, 0, 0, 6] });
  return {
    info: { title: c.title, creator: "Eligible Calls" }, pageSize: "A4", pageMargins: [50, 56, 50, 56],
    content: [
      { text: T("reportsTitle"), style: "eyebrow" }, { text: c.title, style: "h1" },
      { text: [ST.org.name ? `${T("pdf.applicant")}: ${ST.org.name}\n` : "", c.programmeName ? `${c.programmeName}\n` : "", c.deadline ? `${T("deadline")}: ${EC.fmtDate(c.deadline)}\n` : "", c.funding ? `${T("funding")}: ${c.funding}\n` : "",
        T("repSavedAt", fmtTime(rep.createdAt)) + (rep.createdBy ? " · " + rep.createdBy : "") + "\n", T("repProfileV", rep.profileVersion) + (d.dataGenerated ? " · " + T("repDataDate", EC.fmtDate(d.dataGenerated)) : "") + "\n", c.url || ""], style: "meta" },
      ...(rep.note ? [{ text: `${T("repNote")}: ${rep.note}`, margin: [0, 0, 0, 8] }] : []),
      { text: T("repA"), style: "h2" }, { text: `${a.score}% · ${T("bandL." + a.band)} · ${T("statusL." + a.status)}`, bold: true, margin: [0, 0, 0, 4] },
      { text: T("explain." + a.status), margin: [0, 0, 0, 4] }, { text: T("notice"), style: "note" },
      { text: T("repB"), style: "h2" },
      { table: { headerRows: 1, widths: ["*", "18%", "16%"], body: [[T("requirement"), T("result"), T("basis")].map((h) => ({ text: h, bold: true, fontSize: 9 })),
        ...a.checks.map((x) => [{ stack: [codeText(x), ...(x.params.quote ? [{ text: x.params.quote, italics: true, color: "#555", fontSize: 8 }] : [])] }, x.code === "partnership.unspecified" ? T("notStated") : T("resL." + x.result), x.source ? T("srcL." + x.source) : ""])] }, layout: "lightHorizontalLines", margin: [0, 2, 0, 6] },
      { text: T("repB2"), style: "h3" },
      { table: { widths: ["*", "16%", "16%"], body: Object.keys(DEFAULT_WEIGHTS).filter((k) => a.dims[k] !== undefined).map((k) => [T("dims." + k), `${Math.round(100 * a.dims[k])}%`, `${T("weight")} ${a.weights[k]}%`]) }, layout: "lightHorizontalLines", margin: [0, 2, 0, 6] },
      { text: T("repC"), style: "h2" }, ul(a.strengths.map(codeText)),
      { text: T("repD"), style: "h2" }, ul(a.gaps.map((x) => `${T("resL." + x.result)}: ${codeText(x)}`)),
      { text: T("repE"), style: "h2" }, a.missing.length ? { text: listOf(a.missing, fieldName), margin: [0, 0, 0, 6] } : { text: T("missingCall"), italics: true, color: "#777" },
      { text: T("repF"), style: "h2" }, a.next.length ? { ol: a.next.map(codeText) } : { text: T("none"), italics: true, color: "#777" },
    ],
    footer: (cur, tot) => ({ columns: [{ text: "Eligible Calls · " + T("repPdfFooter"), fontSize: 7, color: "#888" }, { text: `${cur} / ${tot}`, alignment: "right", fontSize: 7, color: "#888" }], margin: [50, 20, 50, 0] }),
    defaultStyle: { font: "Roboto", fontSize: 10, lineHeight: 1.25 },
    styles: { eyebrow: { fontSize: 8, color: "#888", margin: [0, 0, 0, 2] }, h1: { fontSize: 17, bold: true, margin: [0, 0, 0, 6] }, h2: { fontSize: 12.5, bold: true, color: "#1f4e79", margin: [0, 10, 0, 4] }, h3: { fontSize: 10.5, bold: true, margin: [0, 6, 0, 2] },
      meta: { fontSize: 9, color: "#444", margin: [0, 0, 0, 8] }, note: { fontSize: 8, italics: true, color: "#666", margin: [0, 0, 0, 4] } },
  };
}
async function downloadReport(rep) {
  const pm = await loadPdfMake();
  await new Promise((res, rej) => { try { pm.createPdf(reportDoc(rep)).download(fileSafe(rep.data.call.title) + "-" + new Date(rep.createdAt).toISOString().slice(0, 10) + ".pdf", res); } catch (e) { rej(e); } });
}
function downloadReportsCsv(list) {
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["saved_at", "call", "programme", "deadline", "score", "status", "profile_version", "score_now", "status_now", "note", "saved_by"];
  const rows = list.map((r) => { const now = liveOf(r.callKey); return [new Date(r.createdAt).toISOString(), r.callTitle, r.programme, r.deadline, r.score, r.status, r.profileVersion, now ? now.score : "", now ? now.status : "", r.note, r.createdBy]; });
  const blob = new Blob(["﻿" + [head, ...rows].map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `saved-reports-${new Date().toISOString().slice(0, 10)}.csv`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const nowCell = (r) => { const now = liveOf(r.callKey); if (!now) return `<span class="fine">${esc(T("repCallGone"))}</span>`; const d = now.score - r.score; return `${scoreNum(now.score)}${d ? ` <span class="fine delta ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : ""}${d}</span>` : ""}${now.status !== r.status ? `<div>${statusBadge(now.status)}</div>` : ""}`; };
async function secReports(arg) {
  const id = ST.org.id;
  await loadOrg(id, true);   // the comparison with today's assessment needs the latest profile
  if (arg) return await secSavedReport(arg);
  const list = (await api("GET", `/orgs/${id}/reports`)).reports;
  ST.reportList = list;
  return `<h1>${esc(T("reportsTitle"))}</h1><p class="lede">${esc(T("reportsLede"))}</p>
    ${list.length ? `<div class="oi-row rep-tools"><div class="fld grow"><label for="rpSearch">${esc(T("reportsSearch"))}</label><input type="search" id="rpSearch" value="${esc(ST.reportQuery || "")}"></div><button type="button" class="btn quiet" id="rpCsv">${esc(T("repCsv"))}</button></div>
      <div class="tscroll"><table class="oi-t rep-t"><thead><tr><th>${esc(T("repColSaved"))}</th><th>${esc(T("repColCall"))}</th><th class="num">${esc(T("repColScore"))}</th><th>${esc(T("repColStatus"))}</th><th class="num">${esc(T("repColNow"))}</th><th></th></tr></thead><tbody>
      ${list.map((r) => `<tr data-q="${esc((r.callTitle + " " + r.programme + " " + r.note).toLowerCase())}"><td>${esc(fmtTime(r.createdAt))}<div class="fine">${esc(T("repProfileV", r.profileVersion))}</div></td>
        <td><a href="#org/${id}/reports/${esc(r.id)}">${esc(r.callTitle)}</a><div class="fine">${esc(r.programme)}${r.deadline ? " · " + esc(EC.fmtDate(r.deadline)) : ""}</div>${r.note ? `<div class="fine rep-note">“${esc(r.note)}”</div>` : ""}</td>
        <td class="num">${scoreNum(r.score)}</td><td>${statusBadge(r.status)}</td><td class="num">${nowCell(r)}</td>
        <td><div class="oi-row"><a class="btn ghost" href="#org/${id}/reports/${esc(r.id)}">${esc(T("open"))}</a><button type="button" class="btn ghost" data-rpdf="${esc(r.id)}">PDF</button></div></td></tr>`).join("")}
      </tbody></table></div><div role="status" id="rpMsg"></div>`
    : `<section class="oi-card"><p>${esc(T("reportsEmpty"))}</p><p><a class="btn quiet" href="#org/${id}/matching">${esc(T("openMatching"))} →</a></p></section>`}`;
}
afterRender.reports = (arg) => {
  if (arg) return bindSavedReport();
  const id = ST.org.id, q = document.getElementById("rpSearch");
  const filter = () => { const v = (q.value || "").trim().toLowerCase(); ST.reportQuery = v; document.querySelectorAll(".rep-t tbody tr").forEach((tr) => { tr.hidden = v && !tr.dataset.q.includes(v); }); };
  if (q) { q.addEventListener("input", filter); filter(); }
  const csv = document.getElementById("rpCsv"); if (csv) csv.addEventListener("click", () => downloadReportsCsv(ST.reportList || []));
  document.querySelectorAll("[data-rpdf]").forEach((b) => b.addEventListener("click", async () => {
    const m = document.getElementById("rpMsg"); b.disabled = true; opState(m, "drawing");
    try { await downloadReport((await api("GET", `/orgs/${id}/reports/${b.dataset.rpdf}`)).report); m.className = "fine ok"; m.textContent = T("pdfDone"); }
    catch (e) { m.className = "note err"; m.textContent = e && e.status ? errText(e) : T("pdfFail"); }
    b.disabled = false;
  }));
};
async function secSavedReport(rid) {
  const id = ST.org.id;
  const rep = (await api("GET", `/orgs/${id}/reports/${encodeURIComponent(rid)}`)).report;
  ST.openReport = rep;
  const d = rep.data, a = d.assessment, now = liveOf(rep.callKey);
  // What changed since the report was saved: score, status and every requirement whose result moved.
  let change = "";
  if (now) {
    const before = Object.fromEntries(a.checks.map((x) => [x.code, x.result]));
    const moved = now.checks.filter((x) => before[x.code] !== undefined && before[x.code] !== x.result);
    const added = now.checks.filter((x) => before[x.code] === undefined);
    const delta = now.score - a.score;
    change = `<section class="oi-card"><h2>${esc(T("repChange"))}</h2>
      <div class="oi-row rep-cmp"><div><span class="fine">${esc(T("repThen"))}</span><div>${scoreNum(a.score)} ${statusBadge(a.status)}</div></div><span aria-hidden="true">→</span>
        <div><span class="fine">${esc(T("repNow"))}</span><div>${scoreNum(now.score)} ${statusBadge(now.status)}${delta ? ` <span class="delta ${delta > 0 ? "up" : "down"}">${delta > 0 ? "+" : ""}${delta}</span>` : ""}</div></div></div>
      ${moved.length || added.length ? `<ul>${moved.map((x) => `<li>${esc(codeText(x))}: <span class="res ${before[x.code]}">${esc(T("resL." + before[x.code]))}</span> → <span class="res ${x.result}">${esc(T("resL." + x.result))}</span></li>`).join("")}${added.map((x) => `<li>${esc(codeText(x))}: <span class="res ${x.result}">${esc(T("resL." + x.result))}</span> <span class="fine">(${esc(T("repNewCheck"))})</span></li>`).join("")}</ul>` : `<p class="fine">${esc(T("repSameResult"))}</p>`}
      <p><a href="#org/${id}/match/${encodeURIComponent(rep.callKey)}">${esc(T("repOpenCurrent"))} →</a></p></section>`;
  } else change = `<p class="note warn">${esc(T("repCallGone"))}</p>`;
  return `<a class="back" href="#org/${id}/reports">← ${esc(T("reportsTitle"))}</a>
    <h1>${esc(d.call.title)}</h1>${callMeta(d.call)}
    <section class="oi-card rep-head"><p class="fine">${esc(T("repSavedAt", fmtTime(rep.createdAt)))}${rep.createdBy ? " · " + esc(rep.createdBy) : ""} · ${esc(T("repProfileV", rep.profileVersion))}${ST.org.version !== rep.profileVersion ? " " + esc(T("repProfileNow", ST.org.version)) : ""}${d.dataGenerated ? " · " + esc(T("repDataDate", EC.fmtDate(d.dataGenerated))) : ""}</p>
      ${canEdit() ? `<div class="oi-row"><div class="fld grow"><label for="rpNote">${esc(T("repNote"))}</label><input type="text" id="rpNote" maxlength="1000" value="${esc(rep.note)}" placeholder="${esc(T("repNotePh"))}"></div><button type="button" class="btn quiet" id="rpNoteSave">${esc(T("repNoteSave"))}</button></div>` : rep.note ? `<p>${esc(T("repNote"))}: ${esc(rep.note)}</p>` : ""}
      <div class="oi-row"><button type="button" class="btn" id="rpPdf"><span class="pdf-ic" aria-hidden="true">PDF</span> ${esc(T("repPdf"))}</button>${canEdit() ? `<button type="button" class="btn ghost" id="rpDel">${esc(T("repDelete"))}</button>` : ""}</div>
      <div role="status" id="rpMsg"></div></section>
    ${change}
    <h2 class="idea-h">${esc(T("repSavedVersion"))}</h2>
    ${reportSections(a, id)}`;
}
function bindSavedReport() {
  const id = ST.org.id, rep = ST.openReport, m = document.getElementById("rpMsg");
  const say = (cls, t) => { m.className = cls; m.textContent = t; };
  const pdf = document.getElementById("rpPdf");
  pdf.addEventListener("click", async () => { pdf.disabled = true; opState(m, "drawing"); try { await downloadReport(rep); say("fine ok", T("pdfDone")); } catch (e) { say("note err", T("pdfFail")); } pdf.disabled = false; });
  const ns = document.getElementById("rpNoteSave");
  if (ns) ns.addEventListener("click", async () => {
    ns.disabled = true; opState(m, "saving");
    try { const note = document.getElementById("rpNote").value; await api("PATCH", `/orgs/${id}/reports/${rep.id}`, { note }); rep.note = note; say("note ok", T("repNoteSaved")); } catch (e) { say("note err", errText(e)); }
    ns.disabled = false;
  });
  // Two clicks delete: the first one asks, the second one (within five seconds) deletes.
  const del = document.getElementById("rpDel");
  if (del) del.addEventListener("click", async () => {
    if (!del.dataset.armed) { del.dataset.armed = "1"; del.textContent = T("repDeleteConfirm"); del.classList.add("danger"); setTimeout(() => { if (del.isConnected) { delete del.dataset.armed; del.textContent = T("repDelete"); del.classList.remove("danger"); } }, 5000); return; }
    del.disabled = true; opState(m, "saving");
    try { await api("DELETE", `/orgs/${id}/reports/${rep.id}`); location.hash = `#org/${id}/reports`; } catch (e) { say("note err", errText(e)); del.disabled = false; }
  });
}

/* ---------- settings ---------- */
async function secSettings() {
  const org = ST.org, owner = org.role === "owner";
  const [mem, ver] = await Promise.all([api("GET", `/orgs/${org.id}/members`), api("GET", `/orgs/${org.id}/versions`)]);
  const roleSel = (uid, role) => owner ? `<select data-role="${uid}">${["owner", "editor", "viewer"].map((r) => `<option value="${r}"${r === role ? " selected" : ""}>${esc(T("roles." + r))}</option>`).join("")}</select>` : esc(T("roles." + role));
  return `<h1>${esc(T("settingsTitle"))}</h1>
    <section class="oi-card"><h2>${esc(T("members"))}</h2><table class="oi-t"><tbody>
      ${mem.members.map((m) => `<tr><td>${esc(m.email)}</td><td>${roleSel(m.id, m.role)}</td><td>${owner && m.id !== ST.me.user.id ? `<button class="linkbtn" data-rm="${m.id}">${esc(T("remove"))}</button>` : ""}</td></tr>`).join("")}
      ${mem.invites.map((i) => `<tr><td>${esc(i.email)} <span class="fine">${esc(T("invited"))}</span></td><td>${esc(T("roles." + i.role))}</td><td>${owner ? `<button class="linkbtn" data-rmi="${esc(i.email)}">${esc(T("remove"))}</button>` : ""}</td></tr>`).join("")}
    </tbody></table>
    ${owner ? `<form class="oi-row" id="oiInvite"><div class="fld"><label for="oiInvEmail">${esc(T("invite"))}</label><input type="email" id="oiInvEmail" required></div><div class="fld"><label for="oiInvRole">${esc(T("role"))}</label><select id="oiInvRole"><option value="editor">${esc(T("roles.editor"))}</option><option value="viewer">${esc(T("roles.viewer"))}</option><option value="owner">${esc(T("roles.owner"))}</option></select></div><button class="btn" type="submit">${esc(T("add"))}</button></form>` : ""}
    ${owner ? `<p class="fine">${esc(T("inviteNote"))}</p>` : ""}
    <p><button class="linkbtn" id="oiLeave">${esc(T("leave"))}</button></p><div id="oiMemMsg" role="status"></div></section>
    <section class="oi-card"><h2>${esc(T("versions"))}</h2><div class="tw"><table class="oi-t"><thead><tr><th>#</th><th></th><th>${esc(T("changedF"))}</th></tr></thead><tbody>
      ${ver.versions.map((v) => `<tr><td class="num">${v.version}</td><td>${esc(fmtTime(v.at))}<div class="fine">${esc(v.by || "")}${v.note ? " · " + esc(v.note) : ""}</div></td><td class="fine">${esc(listOf(v.changed, fieldName))}</td></tr>`).join("")}
    </tbody></table></div></section>
    <section class="oi-card"><h2>${esc(T("account"))}</h2><p class="fine">${esc(ST.me.user.email)}</p>
      <label class="tog"><input type="checkbox" id="oiNewsT"${ST.me.user.news ? " checked" : ""}> ${esc(T("newsToggle"))}</label>
      <p class="fine">${esc(T("deleteAccountNote"))}</p><div><button class="btn ghost" id="oiDelMe">${esc(T("deleteAccount"))}</button></div><div id="oiAccMsg" role="status"></div></section>
    ${owner ? `<section class="oi-card"><h2>${esc(T("deleteOrg"))}</h2><p class="fine">${esc(T("deleteOrgNote", org.name))}</p><div class="fld"><input type="text" id="oiDelName" aria-label="${esc(T("orgName"))}"></div><div><button class="btn ghost" id="oiDelOrg" disabled>${esc(T("confirmDel"))}</button></div></section>` : ""}`;
}
afterRender.settings = () => {
  const org = ST.org, msg = document.getElementById("oiMemMsg");
  const act = async (fn) => { try { await fn(); refresh(); } catch (e) { msg.innerHTML = `<p class="note err">${esc(errText(e))}</p>`; } };
  document.querySelectorAll("[data-role]").forEach((s) => {
    const before = s.value;
    s.addEventListener("change", async () => {
      try { await api("PATCH", `/orgs/${org.id}/members/${s.dataset.role}`, { role: s.value }); refresh(); }
      catch (e) { s.value = before; msg.innerHTML = `<p class="note err">${esc(errText(e))}</p>`; }
    });
  });
  document.querySelectorAll("[data-rm]").forEach((b) => b.addEventListener("click", () => act(() => api("DELETE", `/orgs/${org.id}/members/${b.dataset.rm}`))));
  document.querySelectorAll("[data-rmi]").forEach((b) => b.addEventListener("click", () => act(() => api("DELETE", `/orgs/${org.id}/members/invites/${encodeURIComponent(b.dataset.rmi)}`))));
  const inv = document.getElementById("oiInvite");
  if (inv) inv.addEventListener("submit", (ev) => { ev.preventDefault(); act(() => api("POST", `/orgs/${org.id}/members`, { email: document.getElementById("oiInvEmail").value, role: document.getElementById("oiInvRole").value, lang: L() })); });
  document.getElementById("oiLeave").addEventListener("click", async () => { try { await api("POST", `/orgs/${org.id}/leave`); ST.me = undefined; ST.org = null; go("org"); } catch (e) { msg.innerHTML = `<p class="note err">${esc(errText(e))}</p>`; } });
  document.getElementById("oiNewsT").addEventListener("change", (e) => api("PATCH", "/me", { news: e.target.checked }).then(() => { ST.me.user.news = e.target.checked; }).catch(() => {}));
  bindAccount();
  const dn = document.getElementById("oiDelName"), db = document.getElementById("oiDelOrg");
  if (dn) { dn.addEventListener("input", () => { db.disabled = dn.value.trim() !== org.name; }); db.addEventListener("click", async () => { await api("DELETE", `/orgs/${org.id}`); ST.me = undefined; ST.org = null; try { localStorage.removeItem("konkursi.org"); } catch {} go("org"); }); }
};

window.ECOrg = { render };
window.dispatchEvent(new Event("ecorg-ready"));
