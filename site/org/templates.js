// Official application structures the full-application writer follows (src/org/proposal.js), shared by the browser
// (form, progress, checks, PDF and Word export) and the API (prompts, validation).
//
// Sources, read on 21 November 2026:
//   - Horizon Europe Standard Application Form (HE RIA and IA), Part B, version 5.1 of 22 January 2026
//   - Horizon Europe Standard Application Form (HE CSA), Part B, version 5.1 of 22 January 2026
//   - Horizon Europe Standard Application Form (HE 1st stage RIA and IA), Part B, version 5.0 of 5 November 2025
//   - Erasmus+ 2026 template application forms KA220-ADU and KA220-YOU (same questions) and KA210-ADU, "for
//     information only"; the questions are the same in every field of the action.
// Headings and questions are copied from those documents. A "unit" is one piece the AI writes in one request; tables
// (work packages, deliverables, milestones, risks, staff effort, Gantt chart, lump sum split) are drawn by code from
// the plan, so their numbers always add up.
//
// Erasmus+ forms show each field's character limit only in the online form; the limits are not published in the
// templates, so the page shows the length of every answer and the applicant checks it against the form.

const clip = (s, n) => { s = String(s ?? "").replace(/[ \t]+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

const HE_SRC = (form, version, date, url) => ({ title: `Horizon Europe Standard Application Form (${form}), Part B`, version, date, url });
const HE_URL = "https://ec.europa.eu/info/funding-tenders/opportunities/docs/2021-2027/horizon/temp-form/af/";
const EP_SRC = (action) => ({ title: `Erasmus+ 2026 template application form (${action})`, version: "Call 2026", date: "2025-11", url: "https://erasmus-plus.ec.europa.eu/resources-and-tools/documents-and-guidelines" });

// ---------- Horizon Europe Part B ----------
// unit: { id, n (heading number), title, ask (what the template asks, its own words), target (characters the draft aims
// for), wp (true: one unit per work package, written after the plan) }
const HE_EXCELLENCE_RIA = [
  { id: "s11", n: "1.1", title: "Objectives and ambition", pages: 4, target: 7000, ask: [
    "Briefly describe the objectives of your proposed work. Why are they pertinent to the work programme topic? Are they measurable and verifiable? Are they realistically achievable?",
    "Describe how your project goes beyond the state-of-the-art, and the extent the proposed work is ambitious. Indicate any exceptional ground-breaking R&I, novel concepts and approaches, new products, services or business and organisational models. Where relevant, illustrate the advance by referring to products and services already available on the market. Refer to any patent or publication search carried out.",
    "Describe where the proposed work is positioned in terms of R&I maturity (i.e. where it is situated in the spectrum from 'idea to application', or from 'lab to market'). Where applicable, provide an indication of the Technology Readiness Level, if possible distinguishing the start and by the end of the project."] },
  { id: "s12a", n: "1.2", title: "Methodology", part: "overall methodology", pages: 10, target: 7000, ask: [
    "Describe and explain the overall methodology, including the concepts, models and assumptions that underpin your work. Explain how this will enable you to deliver your project's objectives. Refer to any important challenges you may have identified in the chosen methodology and how you intend to overcome them.",
    "This section should be presented as a narrative. The detailed tasks and work packages are described below under 'Implementation'."] },
  { id: "s12b", n: "1.2", title: "Methodology", part: "linked activities and disciplines", pages: 2, target: 4500, ask: [
    "Describe any national or international research and innovation activities whose results will feed into the project, and how that link will be established.",
    "Explain how expertise and methods from different disciplines will be brought together and integrated in pursuit of your objectives. If you consider that an inter-disciplinary approach is unnecessary in the context of the proposed work, please provide a justification.",
    "For topics where the work programme indicates the need for the integration of social sciences and humanities, show the role of these disciplines in the project or provide a justification if you consider that these disciplines are not relevant to your proposed project."] },
  { id: "s12c", n: "1.2", title: "Methodology", part: "gender dimension and open science", pages: 2, target: 5000, ask: [
    "Describe how the gender dimension (i.e. sex and/or gender analysis) is taken into account in the project's research and innovation content. If you do not consider such a gender dimension to be relevant in your project, please provide a justification. (This question relates to the content of the planned research and innovation activities, and not to gender balance in the teams.)",
    "Describe how appropriate open science practices are implemented as an integral part of the proposed methodology. Show how the choice of practices and their implementation are adapted to the nature of your work. If you believe that none of these practices are appropriate for your project, please provide a justification. Proposals selected for funding will need a data management plan (FAIR data) as a deliverable by month 6."] },
];
const HE_IMPACT = [
  { id: "s21", n: "2.1", title: "Project's pathways towards impact", pages: 3, target: 7000, ask: [
    "Provide a narrative explaining how the project's results are expected to make a difference in terms of impact, beyond the immediate scope and duration of the project.",
    "(a) Describe the unique contribution your project results would make towards (1) the outcomes specified in this topic, and (2) the wider impacts, in the longer term, specified in the respective destinations in the work programme. Provide quantified estimates where possible and meaningful. Be specific, referring to the effects of your project, and not R&I in general in this field. State the target groups that would benefit, broken into particular interest groups or segments of society relevant to this project.",
    "(b) Describe any requirements and potential barriers - arising from factors beyond the scope and duration of the project - that may determine whether the desired outcomes and impacts are achieved (other R&I work, regulatory environment, targeted markets, user behaviour). Describe any mitigating measures you propose. This does not include the critical risks of project management, which are described under 'Implementation'."] },
  { id: "s22", n: "2.2", title: "Measures to maximise impact - Dissemination, exploitation and communication", pages: 3, target: 7000, ask: [
    "Describe the planned measures to maximise the impact of your project by providing a first version of your 'plan for the dissemination and exploitation including communication activities'. Describe the dissemination, exploitation and communication measures that are planned, and the target group(s) addressed (e.g. scientific community, end users, financial actors, public at large). This plan is an admissibility condition unless the topic states otherwise.",
    "Communication measures: state the main messages, the tools and channels for each target group. All measures should be proportionate to the scale of the project, with concrete actions during and after the project; explain why each measure is best suited to its target group; for innovation actions describe a plausible path to commercialise the innovations. Describe possible feedback to policy measures.",
    "Outline your strategy for the management of intellectual property, foreseen protection measures, such as patents, design rights, copyright, trade secrets, etc., and how these would be used to support exploitation."] },
  { id: "s23", n: "2.3", title: "Summary", optional: true, pages: 1, target: 3000, canvas: true, ask: [
    "Summary canvas of the key elements of the impact pathway and of the measures to maximise impact: SPECIFIC NEEDS (what needs triggered this project?), EXPECTED RESULTS (what do you expect to generate by the end of the project?), D & E & C MEASURES (what dissemination, exploitation and communication measures will you apply to the results?), TARGET GROUPS (who will use or further up-take the results? who will benefit?), OUTCOMES (what change do you expect to see after successful dissemination and exploitation?), IMPACTS (what are the expected wider scientific, economic and societal effects?)."] },
];
const HE_IMPLEMENTATION = (pagesStd, pagesLump) => [
  { id: "s31", n: "3.1", title: "Work plan and resources", part: "overall structure", pages: pagesStd, pagesLump, target: 3000, ask: [
    "Brief presentation of the overall structure of the work plan; how the work packages and their components inter-relate (the tables 3.1a to 3.1h and the Gantt chart follow).",
    "Resources assigned to work packages should be in line with their objectives and deliverables. A distinct work package on 'project management' is advised, with due visibility for 'data management', 'dissemination and exploitation' and 'communication activities'."] },
  { id: "wp", n: "3.1", title: "Work package description", wp: true, target: 3500, ask: [
    "Table 3.1b, for each work package: objectives and description of work. Structure the work package by breaking it down into tasks. For each task describe all activities to be carried out and quantify them (e.g., number of protocols, tests, measurements, study subjects, conferences, publications). Provide enough detail to clarify who will do this work and why it is needed for the project (level of qualification and number of person-months, requested equipment, consumables, meetings), to justify the proposed resources."] },
  { id: "s32", n: "3.2", title: "Capacity of participants and consortium as a whole", pages: 3, target: 6000, ask: [
    "Describe the consortium. How does it match the project's objectives, and bring together the necessary disciplinary and inter-disciplinary knowledge? Show how this includes expertise in social sciences and humanities, open science practices, and gender aspects of R&I, as appropriate. Include affiliated entities and associated partners, if any. (The individual participants are described in Part A; do not repeat that information.)",
    "Show how the partners will have access to critical infrastructure needed to carry out the project activities.",
    "Describe how the members complement one another (and cover the value chain, where appropriate).",
    "In what way does each of them contribute to the project? Show that each has a valid role, and adequate resources in the project to fulfil that role."] },
];
const HE_CSA_EXCELLENCE = [
  { id: "s11", n: "1.1", title: "Objectives", pages: 1, target: 4000, ask: [
    "Briefly describe the objectives of your proposed work. Why are they pertinent to the work programme topic? Are they measurable and verifiable? Are they realistically achievable?"] },
  { id: "s12a", n: "1.2", title: "Coordination and/or support measures and methodology", part: "measures and methodology", pages: 4.5, target: 7000, ask: [
    "Describe and explain the coordination and/or support measures and the overall methodology, including the concepts, models and assumptions that underpin your work. Explain how this will enable you to deliver your project's objectives. Refer to any challenges you may have identified in the chosen methodology and how you intend to overcome them.",
    "This section should be presented as a narrative. The detailed tasks and work packages are described below under 'Implementation'."] },
  { id: "s12c", n: "1.2", title: "Coordination and/or support measures and methodology", part: "open science", pages: 1, target: 3500, ask: [
    "Describe how appropriate open science practices are implemented as an integral part of the proposed methodology, including research data management. Show how the choice of practices and their implementation are adapted to the nature of your work. If you believe that none of these practices are appropriate for your project, please provide a justification."] },
];
const HE_STAGE1 = [
  { id: "s11", n: "1.1", title: "Objectives and ambition", pages: 3, target: 5500, ask: [HE_EXCELLENCE_RIA[0].ask[0], HE_EXCELLENCE_RIA[0].ask[1], HE_EXCELLENCE_RIA[0].ask[2]] },
  { id: "s12a", n: "1.2", title: "Methodology", pages: 4, target: 7000, ask: [HE_EXCELLENCE_RIA[1].ask[0], HE_EXCELLENCE_RIA[3].ask[0], HE_EXCELLENCE_RIA[3].ask[1]] },
  { id: "s21", n: "2.1", title: "Project's pathways towards impact", pages: 3, target: 5500, ask: HE_IMPACT[0].ask },
];

const HE_GROUPS = { s11: "1", s12a: "1", s12b: "1", s12c: "1", s21: "2", s22: "2", s23: "2", s31: "3", wp: "3", s32: "3" };
const HE_GROUP_TITLES = { 1: "Excellence", 2: "Impact", 3: "Quality and efficiency of the implementation" };

// ---------- Erasmus+ KA220 and KA210 online forms ----------
// unit: { id, section (form section), questions: [{ id, q }] }. "wp" units repeat for every work package after WP1
// (KA220) or for every activity (KA210).
const KA220_UNITS = [
  { id: "rel1", section: "Relevance of the project", sub: "Priorities and topics; Project description", target: 6500, questions: [
    { id: "priorities", q: "How does the project address the selected priorities?" },
    { id: "motivation", q: "Please describe the motivation for your project and explain why it should be funded." },
    { id: "objectives", q: "What are the objectives you would like to achieve and which concrete results you would like to produce? How are these objectives linked to the priorities you have selected?" },
    { id: "innovative", q: "What makes your proposal innovative?" }] },
  { id: "rel2", section: "Relevance of the project", sub: "Project description", target: 5500, questions: [
    { id: "synergies", q: "How is your proposal suitable for creating synergies between different fields of education, training, youth and sport or how does it have a strong potential impact on one or more of those fields?" },
    { id: "addedValue", q: "How does the proposal bring added value at European level through results that would not be attained by activities carried out in a single country?" },
    { id: "followUpEP", q: "Does this project proposal represent a follow-up or evolution of a previous project or projects funded by Erasmus+?" },
    { id: "followUpOther", q: "Is the project proposal the follow-up or the evolution of a previous project or projects funded under other funding instruments/programmes at EU, national, regional, international level?" },
    { id: "synergyOther", q: "Is the project proposal in synergy with other initiatives or funding instruments?" }] },
  { id: "needs", section: "Relevance of the project", sub: "Needs analysis", target: 6000, questions: [
    { id: "needs", q: "What needs do you want to address by implementing your project?" },
    { id: "targetGroups", q: "What are the target groups of the project? How do the participating organisations engage with the project target groups in their activities?" },
    { id: "needsFound", q: "How did you identify the needs of your partnership and those of your target groups?" },
    { id: "needsMet", q: "How will this project address these needs?" }] },
  { id: "partner", section: "Partnership and cooperation arrangements", sub: "Cooperation arrangements", target: 6000, questions: [
    { id: "formation", q: "How did you form your partnership? How does the mix of participating organisations complement each other and what will be the added value of their collaboration in the framework of the project? If applicable, please list and describe the associated partners involved in the project and their added-value to the project." },
    { id: "tasks", q: "What is the task allocation and how does it reflect the commitment and active contribution of all participating organisations (including the associated partners, if applicable)?" },
    { id: "coordination", q: "Describe the mechanism for coordination and communication between the participating organisations (including the associated partners, if applicable)." }] },
  { id: "impact", section: "Impact and dissemination", target: 6500, questions: [
    { id: "assess", q: "How are you going to assess if the project objectives have been achieved?" },
    { id: "sustain", q: "Explain how you will ensure the sustainability of the project: How will the participation in this project contribute to the development of the involved organisations in the long-term? How do you plan to continue using the project results or implement some of the activities after the project's end?" },
    { id: "dissem", q: "How do you plan to disseminate the result of the project?" },
    { id: "level", q: "At which level will the results of your project generate impact? Please explain in what way the expected results will generate impact for the chosen level(s)." }] },
  { id: "pm1", section: "Project design and implementation", sub: "WP1: Project management", part: "monitoring, budget, risks", target: 5500, questions: [
    { id: "monitor", q: "How will the progress, quality and achievement of project activities be monitored? Please give information about the involved staff, as well as the timing and frequency of the monitoring activities." },
    { id: "budget", q: "How will you ensure proper budget control and time management in your project?" },
    { id: "risks", q: "What are your plans for handling risks for project implementation (e.g. delays, budget, conflicts, etc.)?" }] },
  { id: "pm2", section: "Project design and implementation", sub: "WP1: Project management", part: "inclusion, digital, green, civic", target: 5500, questions: [
    { id: "inclusive", q: "How will you ensure that the activities are designed in an accessible and inclusive way?" },
    { id: "digital", q: "How does the project incorporate the use of digital tools and learning methods to complement the physical activities and to improve cooperation between partner organisations?" },
    { id: "green", q: "How does the project incorporate green practices in different project phases?" },
    { id: "civic", q: "How does the project encourage participation and civic engagement in different project phases?" }] },
  { id: "wp", wp: true, section: "Project design and implementation", target: 7000, questions: [
    { id: "objectives", q: "What are the specific objectives of this work package and how do they contribute to the general objectives of the project?" },
    { id: "results", q: "What will be the main results of this work package?" },
    { id: "qual", q: "What qualitative indicators will you use to measure the level of the achievement of the work package objectives and the quality of the results?" },
    { id: "quant", q: "What quantitative indicators will you use to measure the level of the achievement of the work package objectives and the quality of the results?" },
    { id: "tasks", q: "Please describe the tasks and responsibilities of each partner organisation in the work package." },
    { id: "amount", q: "How did you determine the amount allocated to this work package? How did you verify that it is cost-effective?" },
    { id: "activities", q: "Description of the activities, for each activity of this work package: Describe the content of the proposed activities. Explain how these activities are going to help reach the WP objectives. Describe the expected results of the activities. Expected number and profile of participants." }] },
  { id: "summary", section: "Project summary", target: 3000, summary: true, questions: [
    { id: "sObjectives", q: "Objectives: What do you want to achieve by implementing the project?" },
    { id: "sImplementation", q: "Implementation: What activities are you going to implement?" },
    { id: "sResults", q: "Results: What project results and other outcomes do you expect your project to have?" }] },
];
const KA210_UNITS = [
  { id: "desc1", section: "Project description", target: 5500, questions: [
    { id: "objectives", q: "What are the concrete objectives you would like to achieve and 'outcomes or results you would like to realise'? How are these objectives linked to the priorities you have selected?" },
    { id: "targetNeeds", q: "Please outline the target groups of your project and describe their identified needs" },
    { id: "motivation", q: "Please describe the motivation for your project and explain why it should be funded" }] },
  { id: "desc2", section: "Project description", target: 5000, questions: [
    { id: "needsMet", q: "How does the project address the needs and goals of the participating organisations and the target groups?" },
    { id: "transnational", q: "What will be the benefits of cooperating with transnational partners to achieve the project objectives?" },
    { id: "horizontal", q: "How does the project address the horizontal priorities?" }] },
  { id: "coop", section: "Participating organisations", sub: "Cooperation arrangements", target: 6000, questions: [
    { id: "formation", q: "How was the partnership formed? What are the strengths that each partner will bring to the project?" },
    { id: "management", q: "How will you ensure sound management of the project and good cooperation and communication between partners during project implementation?" },
    { id: "platforms", q: "Please describe how you will use Erasmus+ platforms for preparation, implementation or follow-up of your project?" },
    { id: "tasks", q: "Please describe the tasks and responsibilities of each partner organisation in the project." }] },
  { id: "act", wp: true, section: "Activities", sub: "Activity details", target: 4500, questions: [
    { id: "content", q: "Describe the content of the proposed activity." },
    { id: "target", q: "Describe the target group for this activity. Who is going to take part and who is going to benefit from the results?" },
    { id: "objectives", q: "Explain how is this activity going to help to reach the project objectives." },
    { id: "results", q: "Describe the expected results of the activity." },
    { id: "amount", q: "Please describe how you determined the grant amount attributed to this activity." }] },
  { id: "impact", section: "Impact and follow-up", target: 5500, questions: [
    { id: "measure", q: "How will you know if the project has achieved its objectives? Please explain how you will measure it." },
    { id: "longTerm", q: "How will the participation in this project contribute to the development of the involved organisations in the long-term? Do you have plans to continue using the results of the project or continue to implement some of the activities after the project's end?" },
    { id: "sharing", q: "Please describe your plans for sharing and use of project results. How will you make the results of your project known within your partnership, in your local communities and in the wider public? Who are the main target groups you would like to share your results with? Are there other groups or organisations that will benefit from your project? Please explain how." }] },
  { id: "summary", section: "Project summary", target: 3000, summary: true, questions: [
    { id: "sObjectives", q: "Objectives: What do you want to achieve by implementing the project?" },
    { id: "sImplementation", q: "Implementation: What activities are you going to implement?" },
    { id: "sResults", q: "Results: What results do you expect your project to have?" }] },
];

export const ERASMUS_FIELDS = { school: "SCH", vet: "VET", adult: "ADU", youth: "YOU", higher: "HED" };

export const TEMPLATES = {
  "HE-RIA-IA": { key: "HE-RIA-IA", kind: "partb", programme: "horizon", name: "Horizon Europe Part B: Research and Innovation Actions / Innovation Actions",
    source: HE_SRC("HE RIA and IA", "5.1", "2026-01-22", HE_URL + "af_he-ria-ia_en.pdf"), pageLimit: { standard: 40, lumpSum: 45 },
    units: [...HE_EXCELLENCE_RIA, ...HE_IMPACT, ...HE_IMPLEMENTATION(12, 17)], groups: HE_GROUPS, groupTitles: HE_GROUP_TITLES, tables: true, minParticipants: 3 },
  "HE-CSA": { key: "HE-CSA", kind: "partb", programme: "horizon", name: "Horizon Europe Part B: Coordination and Support Actions",
    source: HE_SRC("HE CSA", "5.1", "2026-01-22", HE_URL + "af_he-csa_en.pdf"), pageLimit: { standard: 25, lumpSum: 28 },
    units: [...HE_CSA_EXCELLENCE, ...HE_IMPACT, ...HE_IMPLEMENTATION(8, 11)], groups: HE_GROUPS, groupTitles: HE_GROUP_TITLES, tables: true, minParticipants: 1 },
  "HE-RIA-IA-S1": { key: "HE-RIA-IA-S1", kind: "partb", programme: "horizon", name: "Horizon Europe Part B: first stage of a two-stage call (RIA / IA)",
    source: HE_SRC("HE 1st stage RIA and IA", "5.0", "2025-11-05", HE_URL + "af_he-ria-ia-stage-1_en.pdf"), pageLimit: { standard: 10, lumpSum: 10 },
    units: HE_STAGE1, groups: HE_GROUPS, groupTitles: HE_GROUP_TITLES, tables: false, minParticipants: 3 },
  KA220: { key: "KA220", kind: "form", programme: "erasmus", action: "KA220", name: "Erasmus+ Cooperation Partnerships (KA220): online application form",
    source: EP_SRC("KA220"), units: KA220_UNITS, wpLabel: "WP" },
  KA210: { key: "KA210", kind: "form", programme: "erasmus", action: "KA210", name: "Erasmus+ Small-scale Partnerships (KA210): online application form",
    source: EP_SRC("KA210"), units: KA210_UNITS, wpLabel: "A" },
};

// Which template a call uses, in this order:
//   1. Erasmus+ KA210/KA220 national-agency rounds and Horizon Europe RIA/IA, CSA and first-stage RIA/IA: written by hand above;
//   2. the application form the call's Portal topic page links to, read by ingest/app_forms.py (site/org/forms.json);
//   3. no readable official form: a structure built from the call's award criteria (site/org/rubric.js);
//   4. no criteria either: a general project structure, labelled as such.
// forms: forms.json (server, with sections) or forms-index.json (browser, names only: units come with the draft).
// rubric: rubricFor() of the call, or null.
const HANDMADE_FILES = { "af_he-ria-ia_en.pdf": "HE-RIA-IA", "af_he-csa_en.pdf": "HE-CSA", "af_he-ria-ia-stage-1_en.pdf": "HE-RIA-IA-S1" };
export function templateFor(callId, crit, forms, rubric) {
  const m = String(callId || "").match(/^ERASMUS-NA-\d{4}-(KA210|KA220)-/);
  if (m) return TEMPLATES[m[1]];
  const e = crit && crit.calls ? crit.calls[callId] : null;
  if (e && e.kind === "framework") {
    if (e.row === "RIA_IA") return TEMPLATES[e.twoStage ? "HE-RIA-IA-S1" : "HE-RIA-IA"];
    if (e.row === "CSA" && !e.twoStage) return TEMPLATES["HE-CSA"];
  }
  const fc = forms && forms.calls ? forms.calls[callId] : null;
  const files = fc ? fc.forms || [] : [];
  if (files.length && files.length <= 4) {
    for (const f of files) if (HANDMADE_FILES[f] && !(HANDMADE_FILES[f] === "HE-RIA-IA" && e && e.twoStage)) return TEMPLATES[HANDMADE_FILES[f]];
    for (const f of files) { const x = forms.forms && forms.forms[f]; if (x && x.usable) return formTemplate(f, x, fc.pageLimit); }
  }
  const limit = fc && fc.pageLimit ? fc.pageLimit : null;
  if (rubric && rubric.criteria && rubric.criteria.length) return criteriaTemplate(rubric, limit);
  return generalTemplate(rubric, limit);
}
export const tplOf = (draft) => (draft && (TEMPLATES[draft.template] || draft.tpl)) || null;

const capWords = (t) => { t = String(t || "").trim(); return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t; };
const WP_DETAIL = /work ?packages?,? activities|work packages?\b.*\b(?:timing|resources)|work plan and (?:resources|allocation)|implementation plan and efficient use/i;
const unitTarget = (limit, n) => Math.max(2500, Math.min(7000, Math.round((((limit || 40) * 3500 * 0.55) / Math.max(1, n)) / 100) * 100));
// A form read from its PDF. The work-package section becomes an overview part and one part per work package; the tables
// (work packages, deliverables, milestones, risks, staff effort, Gantt chart) are drawn by code after the overview.
export function formTemplate(file, f, callLimit) {
  const he = file.startsWith("af_he-");
  const limit = callLimit || f.pageLimit || null;
  const secs = f.sections || null;
  const base = {
    key: "F:" + file, kind: "partb", programme: he ? "horizon" : "eu", basis: "form", name: `${f.form || file} Part B`,
    source: { title: `${he ? "Horizon Europe" : "EU Grants"} Application form (${f.form || file}), Part B`, version: f.version ? "V" + f.version : "", date: f.date || "", url: f.url || "" },
    pageLimit: limit ? { standard: limit, lumpSum: limit } : null, tables: true, minParticipants: 1, units: null, groupTitles: {},
  };
  if (!secs) return base;
  const units = secs.filter((x) => !x.group);
  const narrative = units.filter((x) => !WP_DETAIL.test(x.title)).length + 1;
  const target = unitTarget(limit, narrative);
  const out = [];
  for (const x of units) {
    const id = "f" + x.n.replace(/\./g, "_");
    const ask = x.ask && x.ask.length ? x.ask : [`Write section ${x.n} "${capWords(x.title)}" of the application.`];
    const g = x.n.split(".")[0];
    if (WP_DETAIL.test(x.title)) {
      out.push({ id, n: x.n, title: capWords(x.title), part: "overview", ask: [...ask.slice(0, 2), "Give a brief presentation of the overall structure of the work plan and how the work packages inter-relate; the work package, deliverable, milestone and risk tables follow."], target: 2500, g, tablesAfter: true });
      out.push({ id: "wp", n: x.n, title: "Work package description", wp: true, ask: [...ask, "For this work package: objectives, tasks with the activities of each quantified, who does what, deliverables and milestones."], target: 3500, g });
    } else out.push({ id, n: x.n, title: capWords(x.title), ask, target, g });
  }
  if (!out.some((u) => u.wp)) {
    const g = String(Math.max(...units.map((x) => +x.n.split(".")[0] || 0)) + 1);
    out.push({ id: "fwplan", n: g, title: "Work plan and work packages", part: "overview", ask: ["Overall structure of the work plan and how the work packages inter-relate; the tables follow."], target: 2500, g, tablesAfter: true, extra: true });
    out.push({ id: "wp", n: g, title: "Work package description", wp: true, ask: ["For this work package: objectives, tasks with the activities of each quantified, who does what, deliverables and milestones."], target: 3500, g, extra: true });
  }
  const groupTitles = Object.fromEntries(secs.filter((x) => x.group && !x.n.includes(".")).map((x) => [x.n, capWords(x.title)]));
  return { ...base, units: out, groupTitles };
}
// No readable official form: one section per award criterion of the call, in the order the evaluators score them.
export function criteriaTemplate(rubric, limit) {
  const pts = (v) => String(v).replace(/\.0$/, "");
  const units = [{ id: "sum", n: "0", title: "Project summary", ask: ["A summary of the project for the abstract of the application form: objectives, main activities, expected results and who benefits. At most 2,000 characters."], target: 1800, g: "0" }];
  rubric.criteria.forEach((c, i) => units.push({ id: "c" + (i + 1), n: String(i + 1), title: c.name, g: String(i + 1),
    ask: [`Answer the award criterion "${c.name}"${c.max ? ` (scored out of ${pts(c.max)}${c.min != null ? `, at least ${pts(c.min)} needed` : ""})` : ""}. Cover every element the call lists for it:`, ...(c.aspects || []).slice(0, 8)],
    target: unitTarget(limit, rubric.criteria.length + 2) }));
  const g = String(rubric.criteria.length + 1);
  units.push({ id: "wplan", n: g, title: "Work plan, work packages and resources", part: "overview", ask: ["Overall structure of the work plan, timing and resources; the tables follow."], target: 2500, g, tablesAfter: true });
  units.push({ id: "wp", n: g, title: "Work package description", wp: true, ask: ["For this work package: objectives, tasks with the activities of each quantified, who does what, deliverables and milestones."], target: 3500, g });
  return { key: "CRIT", kind: "partb", programme: "other", basis: "criteria", name: "Structure built from the call's award criteria",
    source: { title: rubric.sourceTitle || "Award criteria of the call", version: "", date: "", url: rubric.url || "" },
    pageLimit: limit ? { standard: limit, lumpSum: limit } : null, tables: true, minParticipants: 1, units, groupTitles: {} };
}
// No official form and no criteria in the data: the elements every funder asks about, in the usual order.
const GENERAL = [
  ["sum", "Project summary", "Objectives, main activities, expected results and who benefits, in a form usable as the abstract. At most 2,000 characters.", 1800],
  ["rel", "Relevance: background, needs and objectives", "Background and rationale; the needs of the target groups, with evidence; general and specific objectives (measurable); how the project answers the call's objectives and priorities.", 6000],
  ["meth", "Approach and methodology", "The approach and methods, why they suit the objectives, what is new compared with existing practice, and how target groups and stakeholders take part.", 6000],
  ["wplan", "Work plan, work packages and resources", "Overall structure of the work plan and timing; the tables follow.", 2500, "wp"],
  ["team", "Partnership, team and management", "Who the applicant and partners are and why they fit the tasks; roles and responsibilities; project management, decision-making, quality assurance and monitoring.", 5000],
  ["impact", "Impact, communication and sustainability", "Expected results and their effects on the target groups and beyond, with indicators; communication and dissemination; how results are used and continued after the project.", 6000],
  ["budget", "Budget and cost-effectiveness", "How the requested amount is divided between work packages and cost categories, and why it is cost-effective. Amounts the applicant has not given are written as to be confirmed.", 3500],
  ["risk", "Risk management", "The main risks to implementation, their likelihood and effect, and the measures that reduce them.", 3500],
];
export function generalTemplate(rubric, limit) {
  const units = [];
  GENERAL.forEach(([id, title, ask, target, wp], i) => {
    const n = String(i), g = n;
    if (wp) {
      units.push({ id, n, title, part: "overview", ask: [ask], target, g, tablesAfter: true });
      units.push({ id: "wp", n, title: "Work package description", wp: true, ask: ["For this work package: objectives, tasks with the activities of each quantified, who does what, deliverables and milestones."], target: 3500, g });
    } else units.push({ id, n, title, ask: [ask], target: limit ? Math.min(target, unitTarget(limit, GENERAL.length)) : target, g });
  });
  const context = rubric && rubric.sourceText ? String(rubric.sourceText).replace(/\s+/g, " ").slice(0, 1500) : "";
  return { key: "GEN", kind: "partb", programme: "other", basis: "general", name: "General project application structure",
    source: { title: rubric && rubric.sourceTitle ? `No official application form in our data; assessment described in: ${rubric.sourceTitle}` : "No official application form in our data", version: "", date: "", url: (rubric && rubric.url) || "" },
    pageLimit: limit ? { standard: limit, lumpSum: limit } : null, tables: true, minParticipants: 1, units, groupTitles: {}, context };
}

// The units of a draft in writing order: work-package units repeat for each WP of the plan (Horizon: every WP;
// KA220: WP2 onwards, WP1 is project management; KA210: every activity). The summary comes last, and in an Erasmus+
// form not written in English the form also asks for the summary in English.
export function unitsOf(tpl, plan, lang) {
  if (!tpl) return [];
  const out = [];
  for (const u of tpl.units || []) {
    if (!u.wp) { out.push({ ...u, key: u.id }); continue; }
    if (!plan) continue;
    if (tpl.key === "KA210") for (const a of plan.activities || []) out.push({ ...u, key: "act_" + a.id, ref: a.id });
    else for (const w of plan.workPackages || []) if (!(tpl.key === "KA220" && w.id === "WP1")) out.push({ ...u, key: "wp_" + w.id, ref: w.id });
  }
  if (tpl.kind === "form" && lang && lang !== "en") {
    const s = tpl.units.find((u) => u.summary);
    out.push({ ...s, id: "summaryEn", key: "summaryEn", english: true });
  }
  // the summary is written from the other answers: last, before its English version
  const sumIdx = out.findIndex((u) => u.key === "summary");
  if (sumIdx >= 0) { const [s] = out.splice(sumIdx, 1); const en = out.findIndex((u) => u.key === "summaryEn"); out.splice(en >= 0 ? en : out.length, 0, s); }
  return out;
}

// ---------- facts the applicant gives before writing ----------
const num = (v) => (v === "" || v === null || v === undefined || isNaN(+v) ? null : +v);
export function cleanFacts(f, tpl, rules, callMax) {
  f = f && typeof f === "object" ? f : {};
  const out = {
    lang: f.lang === "sr" ? "sr" : "en",
    durationMonths: null, amount: null, lumpSumFunding: !!f.lumpSumFunding, role: f.role === "partner" ? "partner" : "coordinator",
    field: null, trl: { start: null, end: null },
    partners: [], team: clip(f.team, 2500), track: clip(f.track, 2500), extra: clip(f.extra, 3000),
  };
  const d = Math.round(num(f.durationMonths) || 0);
  const [dmin, dmax] = rules && rules.durationMonths ? rules.durationMonths : [6, 72];
  if (d >= dmin && d <= dmax) out.durationMonths = d;
  const a = num(f.amount);
  if (tpl && tpl.programme === "erasmus") { if (rules && rules.lumpSums && rules.lumpSums.includes(a)) out.amount = a; }
  else if (a && a > 0) out.amount = Math.round(callMax ? Math.min(a, callMax) : a);
  if (tpl && tpl.programme === "erasmus" && ERASMUS_FIELDS[f.field] && (!rules || !rules.fields || rules.fields.includes(f.field))) out.field = f.field;
  for (const k of ["start", "end"]) { const t = Math.round(num(f.trl && f.trl[k]) || 0); if (t >= 1 && t <= 9) out.trl[k] = t; }
  // partners: one per line "name | country | type | expertise and role" (the form), or objects
  const rows = Array.isArray(f.partners) ? f.partners : String(f.partners || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean).map((l) => { const [name, country, type, role] = l.split("|").map((x) => x.trim()); return { name, country, type, role }; });
  for (const p of rows.slice(0, 15)) {
    if (!p || !clip(p.name, 160)) continue;
    out.partners.push({ name: clip(p.name, 160), country: clip(p.country, 60), type: clip(p.type, 120), role: clip(p.role, 400) });
  }
  return out;
}
export const factsText = (f) => f.partners.map((p) => [p.name, p.country, p.type, p.role].join(" | ")).join("\n");

// Participants: the applicant (P1) and the partners named by the applicant, then placeholders up to the minimum the
// programme requires. Codes P1..Pn are what the plan and every section refer to.
export function participants(profile, facts, tpl, rules) {
  const ps = [{ code: "P1", name: (profile && profile.name) || "(applicant organisation)", country: (profile && profile.country) || "", type: (profile && profile.orgType) || "", role: facts.role === "partner" ? "partner" : "coordinator", applicant: true }];
  facts.partners.forEach((p, i) => ps.push({ code: "P" + (i + 2), name: p.name, country: p.country, type: p.type, role: p.role, named: true }));
  const min = Math.max(tpl ? tpl.minParticipants || 0 : 0, rules && rules.minOrganisations ? rules.minOrganisations : 0);
  while (ps.length < min) ps.push({ code: "P" + (ps.length + 1), name: "(partner to be confirmed)", country: "", type: "", role: "", placeholder: true });
  return ps;
}

// ---------- plan (the backbone the AI writes first) ----------
const ints = (v, lo, hi) => { const n = Math.round(+v); return Number.isFinite(n) && n >= lo && n <= hi ? n : null; };
const arr = (v, n) => (Array.isArray(v) ? v : []).filter((x) => x && typeof x === "object").slice(0, n);
const strs = (v, n, len) => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []).map((x) => clip(x, len)).filter(Boolean).slice(0, n);
const TYPES = ["R", "DEM", "DEC", "DATA", "DMP", "ETHICS", "SECURITY", "OTHER"];
export function cleanPlan(a, { tpl, ps, duration, amount }) {
  if (!a || typeof a !== "object") return null;
  const codes = new Set(ps.map((p) => p.code));
  const code = (c) => (codes.has(String(c || "").trim()) ? String(c).trim() : "P1");
  const D = ints(a.durationMonths, 1, 96) || duration || 24;
  const dur = duration || D;
  const mo = (v, d) => Math.min(dur, Math.max(1, ints(v, 1, 200) || d));
  const p = {
    title: clip(a.title, 200), acronym: clip(String(a.acronym || "").replace(/[^\w\-+& ]/g, ""), 20), durationMonths: dur, summary: clip(a.summary, 1600),
    objectives: arr(a.objectives, 8).map((o, i) => ({ id: "O" + (i + 1), text: clip(o.text, 400), indicator: clip(o.indicator, 240), target: clip(o.target, 160) })).filter((o) => o.text),
    targetGroups: arr(a.targetGroups, 8).map((g) => ({ group: clip(g.group, 160), reach: clip(g.reach, 120) })).filter((g) => g.group),
  };
  p.workPackages = arr(a.workPackages, 9).map((w, i) => {
    const start = mo(w.start, 1), end = Math.max(start, mo(w.end, dur));
    const pm = {}; if (w.pm && typeof w.pm === "object") for (const [k, v] of Object.entries(w.pm)) { const n = +v; if (codes.has(k) && n > 0 && n < 500) pm[k] = Math.round(n * 10) / 10; }
    return { id: "WP" + (i + 1), title: clip(w.title, 160), lead: code(w.lead), start, end, pm, share: Math.max(0, +w.share || 0),
      objectives: strs(w.objectives, 5, 300), tasks: arr(w.tasks, 8).map((t, j) => ({ id: `T${i + 1}.${j + 1}`, title: clip(t.title, 200), lead: code(t.lead), months: clip(t.months, 20) })).filter((t) => t.title) };
  }).filter((w) => w.title);
  if (tpl && tpl.key === "KA220" && p.workPackages[0]) p.workPackages[0].title = "Project management";
  const wpIds = new Set(p.workPackages.map((w) => w.id));
  const wpOf = (v) => (wpIds.has(String(v || "").toUpperCase()) ? String(v).toUpperCase() : p.workPackages[0] ? p.workPackages[0].id : "WP1");
  p.deliverables = arr(a.deliverables, 30).map((d) => ({ wp: wpOf(d.wp), name: clip(d.name, 160), description: clip(d.description, 300), lead: code(d.lead), type: TYPES.includes(String(d.type).toUpperCase()) ? String(d.type).toUpperCase() : "R", dissemination: String(d.dissemination).toUpperCase() === "SEN" ? "SEN" : "PU", month: mo(d.month, dur) })).filter((d) => d.name)
    .sort((x, y) => x.wp.localeCompare(y.wp, "en", { numeric: true }) || x.month - y.month);
  const per = {}; for (const d of p.deliverables) { per[d.wp] = (per[d.wp] || 0) + 1; d.id = `D${d.wp.slice(2)}.${per[d.wp]}`; }
  p.milestones = arr(a.milestones, 15).map((m) => ({ name: clip(m.name, 160), wps: strs(m.wps, 6, 8).map(wpOf), month: mo(m.month, dur), verification: clip(m.verification, 240) })).filter((m) => m.name)
    .sort((x, y) => x.month - y.month).map((m, i) => ({ id: "MS" + (i + 1), ...m }));
  p.risks = arr(a.risks, 12).map((r) => ({ risk: clip(r.risk, 260), likelihood: lvl(r.likelihood), severity: lvl(r.severity), wps: strs(r.wps, 6, 8).map(wpOf), mitigation: clip(r.mitigation, 400) })).filter((r) => r.risk);
  p.activities = arr(a.activities, 16).map((x, i) => ({ id: "A" + (i + 1), wp: wpOf(x.wp), title: clip(x.title, 160), venue: clip(x.venue, 120), start: mo(x.start, 1), end: mo(x.end, dur), lead: code(x.lead),
    participants: strs(x.participants, 15, 6).filter((c) => codes.has(c)), share: Math.max(0, +x.share || 0), results: clip(x.results, 300), participantsNo: clip(x.participantsNo, 120) })).filter((x) => x.title);
  for (const x of p.activities) if (x.end < x.start) x.end = x.start;
  p.budget = arr(a.budget, 10).map((b) => ({ category: clip(b.category, 120), share: Math.max(0, +b.share || 0), note: clip(b.note, 240) })).filter((b) => b.category && b.share > 0);
  normaliseShares(p.budget);
  splitAmounts(p, tpl, amount);
  const missing = [];
  if (!p.title) missing.push("title");
  if (p.objectives.length < 2) missing.push("objectives");
  if (tpl && !["HE-RIA-IA-S1", "KA210"].includes(tpl.key) && p.workPackages.length < 2) missing.push("workPackages");
  if (tpl && tpl.key === "KA210" && !p.activities.length) missing.push("activities");
  if (missing.length) return { incomplete: missing };
  return p;
}
function lvl(v) { v = String(v || "").toLowerCase(); return ["low", "medium", "high"].includes(v) ? v : "medium"; }
function normaliseShares(list) {
  const s = list.reduce((t, x) => t + x.share, 0);
  if (s > 0) for (const x of list) x.share = Math.round((1000 * x.share) / s) / 10;
}
// Lump sum (Erasmus+) or requested amount split into whole euros that add up exactly: work packages (KA220) or
// activities (KA210) by their shares, and each KA220 work package's activities by theirs.
function exactSplit(total, weights) {
  const s = weights.reduce((t, w) => t + w, 0) || weights.length;
  const raw = weights.map((w) => (total * (s === weights.length && !weights.some((x) => x) ? 1 : w)) / s);
  const out = raw.map(Math.floor);
  let rest = total - out.reduce((t, x) => t + x, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((x, y) => y[0] - x[0]).forEach(([, i]) => { if (rest > 0) { out[i]++; rest--; } });
  return out;
}
export function splitAmounts(p, tpl, amount) {
  if (!amount || !tpl) return;
  if (tpl.key === "KA210") {
    exactSplit(amount, p.activities.map((x) => x.share)).forEach((v, i) => (p.activities[i].amount = v));
  } else if (tpl.key === "KA220") {
    exactSplit(amount, p.workPackages.map((w) => w.share)).forEach((v, i) => (p.workPackages[i].amount = v));
    for (const w of p.workPackages) {
      const acts = p.activities.filter((x) => x.wp === w.id);
      if (acts.length) exactSplit(w.amount, acts.map((x) => x.share)).forEach((v, i) => (acts[i].amount = v));
    }
  }
}

// ---------- checks done by code ----------
// Each check: { level: "ok" | "warn" | "bad", key, args } (the page words them; see "chk." strings in app.js).
export const PAGE_CHARS = 3500;   // characters of running text on one Part B page at the template's font size (estimate)
export function estimatePages(draft) {
  const tpl = tplOf(draft);
  if (!tpl || tpl.kind !== "partb") return null;
  const chars = Object.values(draft.sections || {}).reduce((t, s) => t + String((s && s.text) || "").length, 0);
  const p = draft.plan || {};
  const rows = tpl.tables ? (p.workPackages || []).length * 2 + (p.deliverables || []).length + (p.milestones || []).length + (p.risks || []).length * 2 + (p.workPackages || []).length + 12 : 0;
  return Math.round((chars / PAGE_CHARS + rows / 28 + 1) * 10) / 10;   // + title and list of participants
}
const TBC = /\((?:to be confirmed|potrebno potvrditi|partner to be confirmed)\)/gi;
export function checkDraft(draft, { rules, callMax } = {}) {
  const tpl = tplOf(draft);
  if (!tpl) return [];
  const out = [], f = draft.facts || {}, p = draft.plan || {}, ps = draft.participants || [];
  const units = unitsOf(tpl, draft.plan, f.lang);
  const missing = units.filter((u) => !(draft.sections && draft.sections[u.key] && draft.sections[u.key].text));
  out.push(missing.length ? { level: "bad", key: "unitsMissing", args: [missing.length, units.length] } : { level: "ok", key: "unitsDone", args: [units.length] });
  if (tpl.kind === "partb") {
    const pages = estimatePages(draft), lim = tpl.pageLimit ? (f.lumpSumFunding ? tpl.pageLimit.lumpSum : tpl.pageLimit.standard) : null;
    out.push(lim ? { level: pages > lim ? "bad" : "ok", key: "pages", args: [pages, lim] } : { level: "warn", key: "pagesUnknown", args: [pages] });
    const countries = new Set(ps.filter((x) => !x.placeholder && x.country).map((x) => String(x.country).toLowerCase()));
    if (tpl.minParticipants > 1) {
      const named = ps.filter((x) => !x.placeholder).length;
      out.push(named >= 3 && countries.size >= 3 ? { level: "ok", key: "consortium", args: [named, countries.size] } : { level: "warn", key: "consortiumHE", args: [named, countries.size] });
    }
    if (tpl.basis !== "form" && tpl.basis !== undefined) out.push({ level: "warn", key: tpl.basis === "criteria" ? "basisCriteria" : "basisGeneral", args: [] });
    if (tpl.tables) {
      const dmp = (p.deliverables || []).find((d) => d.type === "DMP");
      if (tpl.programme === "horizon") out.push(dmp && dmp.month <= 6 ? { level: "ok", key: "dmp", args: [dmp.id, dmp.month] } : { level: "warn", key: "dmpMissing", args: [] });
      const pmWp = (p.workPackages || []).find((w) => /manag|upravlj|koordin/i.test(w.title));
      out.push(pmWp ? { level: "ok", key: "pmWp", args: [pmWp.id] } : { level: "warn", key: "pmWpMissing", args: [] });
    }
    if (f.amount && callMax && f.amount > callMax) out.push({ level: "bad", key: "overMax", args: [f.amount, callMax] });
  } else {
    const r = rules || {};
    if (r.lumpSums) out.push(r.lumpSums.includes(f.amount) ? { level: "ok", key: "lumpSum", args: [f.amount] } : { level: "bad", key: "lumpSumMissing", args: [r.lumpSums] });
    if (r.durationMonths) out.push(f.durationMonths ? { level: "ok", key: "duration", args: [f.durationMonths, r.durationMonths[0], r.durationMonths[1]] } : { level: "warn", key: "durationMissing", args: [r.durationMonths[0], r.durationMonths[1]] });
    const countries = new Set(ps.filter((x) => !x.placeholder && x.country).map((x) => String(x.country).toLowerCase()));
    const named = ps.filter((x) => !x.placeholder).length;
    if (r.minOrganisations) out.push(named >= r.minOrganisations && countries.size >= r.minCountries ? { level: "ok", key: "consortium", args: [named, countries.size] } : { level: "warn", key: "consortiumEP", args: [r.minOrganisations, r.minCountries, named, countries.size] });
    if (f.amount) {
      const items = tpl.key === "KA210" ? p.activities || [] : p.workPackages || [];
      const sum = items.reduce((t, x) => t + (x.amount || 0), 0);
      out.push(sum === f.amount ? { level: "ok", key: "split", args: [items.length, f.amount] } : { level: "bad", key: "splitOff", args: [sum, f.amount] });
    }
    if (!f.field && tpl.key) out.push({ level: "warn", key: "fieldMissing", args: [] });
  }
  const tbc = Object.values(draft.sections || {}).reduce((t, s) => t + ((String((s && s.text) || "").match(TBC) || []).length), 0) + ps.filter((x) => x.placeholder).length;
  out.push(tbc ? { level: "warn", key: "tbc", args: [tbc] } : { level: "ok", key: "noTbc", args: [] });
  return out;
}

// ---------- document model, drawn as PDF (pdfmake) or Word (docx) in the browser ----------
// Blocks: { h: 1|2|3, text } · { p: text } · { qa: question, text } · { table: { head, rows, widths } } · { gantt: { months, rows } }
// · { note: text }. Section texts keep the AI's paragraph breaks; "### " lines inside a section become level 3 headings.
export function documentModel(draft, L) {
  const tpl = tplOf(draft), p = draft.plan || {}, f = draft.facts || {}, ps = draft.participants || [];
  const S = draft.sections || {}, out = [];
  const txt = (k) => (S[k] && S[k].text) || "";
  const paras = (t) => {
    const blocks = [];
    for (const raw of String(t || "").split(/\n{2,}|\n(?=### )/)) {
      const s = raw.trim(); if (!s) continue;
      if (s.startsWith("### ")) blocks.push({ h: 3, text: s.slice(4).trim() });
      else blocks.push({ p: s });
    }
    return blocks.length ? blocks : [{ p: L.tbc, missing: true }];
  };
  const name = (c) => { const x = ps.find((y) => y.code === c); return x ? (x.name || c) : c; };
  out.push({ h: 1, text: p.title || draft.title || "" });
  if (p.acronym) out.push({ p: `${L.acronym}: ${p.acronym}` });
  out.push({ meta: [draft.call && draft.call.id ? `${L.call}: ${draft.call.id}${draft.call.title ? " · " + draft.call.title : ""}` : "", `${L.template}: ${tpl.source.title}${tpl.source.version ? ", " + tpl.source.version : ""}${tpl.source.date ? " (" + tpl.source.date + ")" : ""}`, p.durationMonths ? `${L.duration}: ${p.durationMonths} ${L.months}` : "", f.amount ? `${tpl.programme === "erasmus" ? L.lumpSum : L.requested}: ${L.money(f.amount)} EUR` : ""].filter(Boolean) });
  out.push({ note: L.disclaimer });
  const partTable = { table: { head: [L.no, L.participant, L.country, L.orgType], rows: ps.map((x) => [x.code, x.name + (x.applicant ? ` (${f.role === "partner" ? L.partner : L.coordinator})` : ""), x.country || L.tbcShort, x.type || ""]), widths: ["8%", "*", "18%", "26%"] } };
  if (tpl.kind === "partb") {
    out.push({ h: 2, text: L.participants }, partTable);
    let group = null;
    for (const u of unitsOf(tpl, p, f.lang)) {
      const g = u.g || (tpl.groups && tpl.groups[u.id]);
      if (u.wp) continue;   // drawn with the work plan tables
      if (!String(u.n).includes(".")) {
        const head = `${u.n === "0" ? "" : u.n + ". "}${u.title}`;
        if (!out.some((b) => b.h === 2 && b.text === head)) out.push({ h: 2, text: head });
        group = g;
      } else {
        if (g !== group) { group = g; if (tpl.groupTitles && tpl.groupTitles[g]) out.push({ h: 2, text: `${g}. ${tpl.groupTitles[g]}` }); }
        const head = `${u.n} ${u.title}`;
        if (!out.some((b) => b.h === 3 && b.text === head)) out.push({ h: 3, text: head });
      }
      out.push(...paras(txt(u.key)).map((b) => ({ ...b, unit: u })));
      if ((u.id === "s31" || u.tablesAfter) && tpl.tables) out.push(...workPlanTables(draft, L, name, String(tpl.key).startsWith("HE-") ? "he" : "plain"));
    }
  } else {
    const sec = (t) => out.push({ h: 2, text: t });
    const qa = (u) => {
      const parsed = (S[u.key] && S[u.key].answers) || {};
      for (const q of u.questions) out.push({ qa: q.q, text: parsed[q.id] || "", count: true });
    };
    const units = unitsOf(tpl, p, f.lang);
    const ctx = [
      [L.field, f.field ? tpl.action + "-" + ERASMUS_FIELDS[f.field] : L.tbcShort], [L.duration, p.durationMonths ? `${p.durationMonths} ${L.months}` : L.tbcShort],
      [L.lumpSum, f.amount ? L.money(f.amount) + " EUR" : L.tbcShort], [L.formLang, f.lang === "sr" ? "Srpski" : "English"]];
    sec(L.context); out.push({ table: { head: [L.item, L.value], rows: ctx, widths: ["35%", "*"] } });
    sec(L.participatingOrgs); out.push(partTable);
    let last = null, lastSub = null;
    for (const u of units) {
      if (u.wp) {
        if (tpl.key === "KA220") {
          const w = (p.workPackages || []).find((x) => x.id === u.ref);
          if (last !== "wps") { sec(u.section); out.push(...ka220Tables(draft, L)); last = "wps"; }
          out.push({ h: 3, text: `${w.id}: ${w.title}${w.amount ? ` · ${L.money(w.amount)} EUR` : ""}` });
          qa(u);
          const acts = (p.activities || []).filter((x) => x.wp === w.id);
          if (acts.length) out.push({ table: { head: [L.activity, L.venue, L.start, L.end, L.lead, L.amount, L.expected], rows: acts.map((x) => [x.title, x.venue || "", "M" + x.start, "M" + x.end, name(x.lead), x.amount ? L.money(x.amount) : "", x.results || ""]), widths: ["20%", "12%", "7%", "7%", "14%", "10%", "*"] } });
        } else {
          const a = (p.activities || []).find((x) => x.id === u.ref);
          if (last !== "acts") { sec(u.section); out.push({ table: { head: [L.activity, L.start, L.end, L.amount], rows: (p.activities || []).map((x) => [x.title, "M" + x.start, "M" + x.end, x.amount ? L.money(x.amount) : ""]), widths: ["*", "12%", "12%", "18%"] } }); last = "acts"; }
          out.push({ h: 3, text: `${a.title}` }, { p: [`${L.venue}: ${a.venue || L.tbcShort}`, `${L.start}–${L.end}: M${a.start}–M${a.end}`, `${L.lead}: ${name(a.lead)}`, a.amount ? `${L.amount}: ${L.money(a.amount)} EUR` : ""].filter(Boolean).join(" · ") });
          qa(u);
        }
        continue;
      }
      const title = u.english ? `${u.section} (English)` : u.section;
      if (last !== title) { sec(title); last = title; lastSub = null; }
      if (u.sub && u.sub !== lastSub) out.push({ h: 3, text: u.sub });
      lastSub = u.sub || null;
      if (u.id === "pm1" && tpl.key === "KA220") { const w = (p.workPackages || [])[0]; if (w && w.amount) out.push({ p: `${L.pmAmount}: ${L.money(w.amount)} EUR` }); }
      qa(u);
    }
    if (tpl.key === "KA210") { sec(L.budgetSummary); out.push({ table: { head: [L.activity, L.amount], rows: [...(p.activities || []).map((x) => [x.title, x.amount ? L.money(x.amount) : ""]), [L.total, f.amount ? L.money(f.amount) : ""]], widths: ["*", "25%"] } }); }
  }
  return out;
}
function workPlanTables(draft, L, name, style = "he") {
  const p = draft.plan || {}, ps = draft.participants || [], S = draft.sections || {}, out = [];
  const T = (code, label) => ({ h: 3, text: style === "he" ? `Table ${code}: ${label}` : label });
  const pmOf = (w) => Object.values(w.pm || {}).reduce((t, x) => t + x, 0);
  out.push({ h: 3, text: L.gantt }, { gantt: { months: p.durationMonths || 24, rows: (p.workPackages || []).map((w) => ({ label: w.id, start: w.start, end: w.end })) } });
  out.push(T("3.1a", L.t31a), { table: { head: [L.wpNo, L.wpTitle, L.leadNo, L.leadName, L.pm, L.startM, L.endM], rows: (p.workPackages || []).map((w) => [w.id, w.title, w.lead, name(w.lead), fmt1(pmOf(w)), "M" + w.start, "M" + w.end]), widths: ["8%", "*", "8%", "20%", "9%", "9%", "9%"] } });
  out.push(T("3.1b", L.t31b));
  for (const w of p.workPackages || []) {
    out.push({ table: { head: [L.wpNo, w.id, L.leadName, name(w.lead)], rows: [[L.wpTitle, { colSpan: 3, text: w.title }, "", ""], [L.startEnd, { colSpan: 3, text: `M${w.start}–M${w.end}` }, "", ""], [L.objectives, { colSpan: 3, text: (w.objectives || []).join("\n") }, "", ""]], widths: ["18%", "*", "18%", "*"] } });
    const t = S["wp_" + w.id] && S["wp_" + w.id].text;
    out.push({ p: L.descWork, bold: true });
    for (const b of String(t || L.tbc).split(/\n{2,}/)) if (b.trim()) out.push(b.trim().startsWith("### ") ? { h: 4, text: b.trim().slice(4) } : { p: b.trim() });
  }
  out.push(T("3.1c", L.t31c), { table: { head: [L.no, L.delName, L.shortDesc, L.wpNo, L.leadName, L.type, L.dissem, L.month], rows: (p.deliverables || []).map((d) => [d.id, d.name, d.description || "", d.wp, name(d.lead), d.type, d.dissemination, String(d.month)]), widths: ["7%", "17%", "*", "7%", "14%", "8%", "8%", "7%"] } });
  out.push(T("3.1d", L.t31d), { table: { head: [L.no, L.msName, L.relWp, L.dueMonth, L.verification], rows: (p.milestones || []).map((m) => [m.id, m.name, m.wps.join(", "), String(m.month), m.verification || ""]), widths: ["8%", "26%", "12%", "10%", "*"] } });
  out.push(T("3.1e", L.t31e), { table: { head: [L.riskDesc, L.wpsInvolved, L.mitigation], rows: (p.risks || []).map((r) => [`${r.risk} (${L.likelihood}: ${L.lv[r.likelihood]}; ${L.severity}: ${L.lv[r.severity]})`, r.wps.join(", "), r.mitigation || ""]), widths: ["38%", "14%", "*"] } });
  const wps = p.workPackages || [];
  const effRows = ps.map((x) => [`${x.code} ${x.name}`, ...wps.map((w) => fmt1(w.pm[x.code] || 0)), fmt1(wps.reduce((t, w) => t + (w.pm[x.code] || 0), 0))]);
  effRows.push([L.totalPm, ...wps.map((w) => fmt1(pmOf(w))), fmt1(wps.reduce((t, w) => t + pmOf(w), 0))]);
  out.push(T("3.1f", L.t31f), { table: { head: [L.participant, ...wps.map((w) => w.id), L.totalPm], rows: effRows, widths: ["*", ...wps.map(() => "8%"), "12%"] } });
  if (style === "he") { out.push(T("3.1g", L.t31g), { note: L.t31gNote }); out.push(T("3.1h", L.t31h), { note: L.t31hNote }); }
  return out;
}
function ka220Tables(draft, L) {
  const p = draft.plan || {}, f = draft.facts || {};
  const rows = (p.workPackages || []).map((w) => [w.id, w.title, String((p.activities || []).filter((x) => x.wp === w.id).length), w.amount ? L.money(w.amount) : ""]);
  rows.push([L.total, "", "", f.amount ? L.money(f.amount) : ""]);
  return [{ table: { head: [L.wpNo, L.wpTitle, L.noActivities, L.grant], rows, widths: ["10%", "*", "16%", "18%"] } }, { note: L.subcontractNote }];
}
const fmt1 = (n) => String(Math.round(n * 10) / 10);

// Plain text of a draft for the evaluator (src/org/evaluate.js): plan essentials and the start of every section,
// shared out so each part of the application is seen, within `max` characters.
export function draftDigest(draft, max = 9000) {
  const p = draft.plan || {}, S = draft.sections || {};
  const head = [`Title: ${p.title || ""}`, `Summary: ${clip(p.summary, 700)}`, `Objectives: ${(p.objectives || []).map((o) => `${o.id} ${o.text} (${o.indicator}: ${o.target})`).join("; ")}`,
    `Work packages: ${(p.workPackages || []).map((w) => `${w.id} ${w.title} M${w.start}-M${w.end}`).join("; ")}`,
    `Participants: ${(draft.participants || []).map((x) => `${x.code} ${x.name}${x.country ? " (" + x.country + ")" : ""}`).join("; ")}`].join("\n");
  const keys = Object.keys(S).filter((k) => S[k] && (S[k].text || S[k].answers));
  const room = Math.max(400, Math.floor((max - head.length) / Math.max(1, keys.length)));
  const body = keys.map((k) => `[${S[k].title || k}] ${clip(S[k].text || Object.values(S[k].answers || {}).join(" "), room - 20)}`).join("\n");
  return (head + "\n" + body).slice(0, max);
}
