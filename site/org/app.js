// Organization Intelligence: the organisation dashboard of Eligible Calls.
// Uses the page's loaded data through window.EC (index.html) and the API under /api/.
import { FIELDS, FIELD, ORG_TYPES, TARGET_GROUPS, SCOPES, EXPERIENCE, completeness } from "./schema.js";
import { assessAll, assess, buildDF, band, scoreTier, STATUS_ORDER, DEFAULT_WEIGHTS } from "./rules.js";

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
    complete: "Profile completeness", analysed: "Open calls analysed", high: "Highly compatible (75%+)", eligibleN: "Eligible on available information",
    missingTitle: "Missing information", missingNone: "Every field that counts for matching is filled in.", strengthsTitle: "Strengths seen in the profile",
    upcoming: "Upcoming deadlines of compatible calls", none: "None yet.", lastUpdate: (d, v) => `Profile version ${v}, saved ${d}.`, recentRuns: "Recent extractions",
    fillProfile: "Fill in the profile", openMatching: "See all matches",
    save: "Save profile", saved: (v) => `Saved as version ${v}.`, unsaved: "Unsaved changes", conflict: "Someone else saved the profile in the meantime. Reload to see their version; your changes are kept in this form.", reload: "Reload",
    invalid: "Some fields are not valid; they are marked below.", viewerNote: "You can view this organisation. Only editors and owners can change it.",
    sections: { identity: "Identity", about: "Mission and activities", experience: "Experience", capacity: "Capacity and resources", partners: "Partnerships" },
    prov: { manual: "entered by hand", document: "from document", web: "from website" }, unverified: "not verified", verifiedBy: "approved",
    yes: "Yes", no: "No", unknown: "Not stated",
    docsTitle: "Documents and sources", docsLede: "Upload a statute, registration certificate, annual report or project document, or name your website. The text is read in your browser and sent once to the AI model; the file itself is not stored. Nothing changes in the profile until you approve it.",
    upload: "Choose a document (PDF, DOCX or TXT)", reading: "Reading the document…", sending: (i, n) => `Analysing part ${i} of ${n}…`, scanned: "No text could be read from this file. It is probably a scanned image; OCR is not available yet. Upload a text PDF or a Word file, or type the facts in the profile.",
    tooLong: (n, max) => `The document is long: only the first ${max} parts (${n} characters) are analysed.`,
    webTitle: "Read from your website", webLede: "We read the page you name and up to two linked pages about the organisation (\"About us\", \"Mission\", \"Projects\"), on the same site, respecting robots.txt. Only facts that are quoted from those pages are proposed.", url: "Website or page address", readSite: "Read website",
    review: "Review proposed fields", reviewLede: "Each value comes with the sentence it was taken from. Values that are not clearly supported by their quote, or that the profile already has, start unticked; check them yourself. Lists are added to what the profile already has.",
    field: "Field", proposed: "Proposed value", current: "Current value", evidence: "Source quote", conf: "Confidence", found: "Quote found in source", notFound: "Quote NOT found in source", valueNotInQuote: "Quote found, but the value is not written in it", weakQuote: "Quote found, but it does not clearly state this value", adds: (v) => `Adds: ${v}`, alreadyHas: "Already in the profile", same: "Same as the profile",
    apply: "Apply selected to profile", discard: "Discard", applied: (n) => `${n} field(s) added to the profile.`, runs: "Earlier extractions", status: { review: "to review", applied: "applied", discarded: "discarded" }, del: "Delete", open: "Open",
    confL: { high: "high", medium: "medium", low: "low" }, dropped: (n) => `${n} proposed value(s) were removed because they were invalid or contained personal data.`, noQuote: (n) => `${n} value(s) without a quote from the source were left out.`,
    matchTitle: "Eligibility matching", matchLede: (n, d) => `${n} open and forthcoming calls checked against your profile (data of ${d}). Rule-based: mandatory requirements first, then a weighted compatibility score.`,
    scoreLegend: "Score colours: red 0–49%, yellow 50–74%, green 75–100%. The colour shows the compatibility score only; whether you are eligible is decided by the mandatory requirements (status label).", tierL: { high: "75–100%", medium: "50–74%", low: "0–49%" },
    notice: "Compatibility is an estimate, not a legal eligibility decision and not a probability of funding. The official call documents prevail.",
    fStatus: "All statuses", fProg: "All programmes", fDl: "Any deadline", dl30: "Next 30 days", dl60: "Next 60 days", dl120: "Next 120 days", onlyHigh: "Only 75%+", sortScore: "Sort: compatibility", sortDl: "Sort: deadline",
    showing: (n, m) => `${n} of ${m} calls`, more: "Show more", strengths: "Strengths", problems: "Possible problems", missing: "Missing information", next: "Next step", report: "Detailed assessment", official: "Official page",
    deadline: "Deadline", funding: "Funding", notStated: "No requirement stated", missingCall: "The profile has the information this assessment uses for this call.", perGrant: "per grant", topicBudget: "total budget of the topic", programme: "Programme", noCountry: "Add your country and organisation type to the profile: without them no call can be checked.",
    statusL: { eligible: "Eligible based on available information", potential: "Potentially eligible: verification required", ineligible: "Ineligible: mandatory requirement not met", insufficient: "Insufficient information" },
    bandL: { excellent: "Excellent compatibility", strong: "Strong compatibility", moderate: "Moderate compatibility", low: "Low compatibility", verylow: "Very low compatibility" },
    repA: "A. Overall assessment", repB: "B. Requirements checked", repB2: "Compatibility by dimension", repC: "C. Organisational strengths", repD: "D. Eligibility gaps", repE: "E. Missing information", repF: "F. Recommendations",
    requirement: "Requirement", result: "Result", basis: "Basis", weight: "Weight", part: "Score",
    resL: { pass: "Met", fail: "Not met", warn: "Possible problem", unknown: "To verify", missing: "Profile data missing" },
    srcL: { "programme-list": "Commission list of participating countries", call: "call text", source: "source of the call", derived: "Eligible Calls rules on the call text", "call-rule": "official text quoted", none: "source data" },
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
    ideasGenerate: "Generate ideas", ideasRegenerate: "Generate new ideas", ideasBusy: "Writing ideas… this can take up to a minute.", ideasUse: "Uses one of your daily AI actions. Unsaved suggestions are replaced; saved ideas stay.",
    ideasDone: (n, d) => `${n} idea(s) generated.` + (d ? ` ${d} proposal(s) were discarded because they named a call that was not selected or were incomplete.` : ""), ideasZero: "The model found no selected call that genuinely fits the profile. Try other calls or complete the profile.",
    ideasNone: "No ideas yet.", ideasSaved: "Saved ideas", ideasSuggested: "Latest suggestions", ideasViewerNote: "You can read the ideas. Editors and owners generate, save and annotate them.",
    ideaSavedChip: "Saved", ideaSave: "Save", ideaUnsave: "Remove from saved", ideaNotes: "Notes", ideaNotesSave: "Save notes", ideaNotesSaved: "Notes saved.", ideaCompare: "Compare", ideaDelete: "Delete",
    ideaF: { concept: "Project concept", problem: "Problem addressed", solution: "Proposed solution", objectives: "Main objectives", targetGroups: "Target groups", activities: "Proposed activities", expectedResults: "Expected results and impact", potentialPartners: "Potential partners", whyItFits: "Why this project makes sense" },
    ideaCall: "Matching funding opportunity", compatRule: "Organisation–call compatibility (rules)", conceptFitL: "Concept fit (AI estimate)", fitTitle: "AI ratings (1–5)",
    fitL: { alignment: "Alignment with the call", priorities: "Programme priorities", feasibility: "Feasibility", impact: "Potential impact" },
    ideaStale: (v) => `Generated from profile version ${v}; the profile has changed since.`, ideaClosed: "This call is no longer open.", ideaGen: (d, sc) => `Generated ${d}; compatibility at that time ${sc}%.`,
    compareTitle: "Comparison", compareHint: "Tick Compare on two or three ideas to see them side by side.", compareMax: "You can compare up to three ideas.", savedIdeasN: "Saved project ideas",
    reportsTitle: "Saved reports", reportsSoon: "Saving and exporting reports comes with the evaluation assistant (next phase). Assessments are recalculated live on the matching page.",
    settingsTitle: "Settings", members: "Members", invite: "Add a member by e-mail", role: "Role", roles: { owner: "Owner", editor: "Editor", viewer: "Viewer" }, add: "Add",
    invited: "Invited (not signed up yet)", remove: "Remove", leave: "Leave this organisation", versions: "Profile history", changedF: "Changed fields", by: "by",
    account: "Your account", newsToggle: "News e-mails", deleteAccount: "Delete my account", deleteAccountNote: "Deletes your account, your sign-in sessions and the organisations where you are the only member.", deleteAccountConfirm: "Yes, delete my account permanently", cancel: "Cancel", signedInAs: (e) => `Signed in as ${e}`,
    deleteOrg: "Delete this organisation", deleteOrgNote: (n) => `Deletes the profile, its history and all extraction results. Type the organisation name (${n}) to confirm.`, confirmDel: "Delete permanently",
    errors: { signin: "Please sign in.", role: "Your role does not allow this.", not_found: "Not found, or you do not have access.", email: "Enter a valid e-mail address.", terms: "Please accept the privacy notice.", verification: "The bot check failed. Reload the page and try again.", too_many: "Too many requests for today. Try again tomorrow.", email_unavailable: "Sign-in e-mails cannot be sent right now.", ai_user_limit: "You have used today's AI actions. They reset at midnight UTC.", ai_resting: "The AI allowance for today is used up. It resets at midnight UTC.", ai_busy: "The AI service is busy. Try again in a minute.", ai_unavailable: "The AI service did not answer. Try again later.", ai_bad_answer: "The AI answer could not be read. Try again.", url_invalid: "Enter a public web address (https://…).", robots_disallow: "The site's robots.txt does not allow automated reading of this page.", page_unavailable: "The page could not be opened.", pdf_upload_instead: "This address is a PDF: download it and upload it as a document.", unsupported_type: "This address is not a web page.", page_empty: "No readable text on this page.", text_too_short: "Too little text to analyse.", last_owner: "An organisation needs at least one owner.", transfer_ownership: "Make another member owner of your shared organisations first.", version_conflict: "Someone else saved the profile in the meantime.", too_many_orgs: "You have reached the number of organisations per account.", google_off: "Google sign-in is not set up on this site yet.", google_cancelled: "Google sign-in was cancelled.", google_state: "The sign-in took too long or was opened in another tab. Please try again.", google_failed: "Google sign-in failed. Please try again.", google_unverified: "Google has not verified this e-mail address.", email_login_off: "Sign-in by e-mail link is not available.", server_error: "Something went wrong on the server.", csrf: "The request was blocked as cross-site. Reload the page.", db_unavailable: "The database is not connected.", network: "No connection to the server.", ideas_limit: "Your organisation has used today's idea generations. Try again tomorrow.", no_calls: "None of the selected calls is open to your organisation.", profile_incomplete: "Complete the profile first: name, type, country and a description.", data_unavailable: "The call data could not be read. Try again later." },
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
    complete: "Popunjenost profila", analysed: "Analiziranih otvorenih poziva", high: "Visoka kompatibilnost (75%+)", eligibleN: "Podobni prema dostupnim podacima",
    missingTitle: "Podaci koji nedostaju", missingNone: "Sva polja važna za proveru su popunjena.", strengthsTitle: "Prednosti uočene u profilu",
    upcoming: "Predstojeći rokovi kompatibilnih poziva", none: "Još nema.", lastUpdate: (d, v) => `Verzija profila ${v}, sačuvana ${d}.`, recentRuns: "Poslednja izdvajanja",
    fillProfile: "Popunite profil", openMatching: "Svi rezultati",
    save: "Sačuvaj profil", saved: (v) => `Sačuvano kao verzija ${v}.`, unsaved: "Nesačuvane izmene", conflict: "Neko drugi je u međuvremenu sačuvao profil. Učitajte ponovo da vidite njegovu verziju; vaše izmene ostaju u formularu.", reload: "Učitaj ponovo",
    invalid: "Neka polja nisu ispravna; označena su ispod.", viewerNote: "Možete da pregledate ovu organizaciju. Menjati je mogu samo urednici i vlasnici.",
    sections: { identity: "Osnovni podaci", about: "Misija i aktivnosti", experience: "Iskustvo", capacity: "Kapaciteti i resursi", partners: "Partnerstva" },
    prov: { manual: "uneto ručno", document: "iz dokumenta", web: "sa sajta" }, unverified: "nije provereno", verifiedBy: "odobreno",
    yes: "Da", no: "Ne", unknown: "Nije navedeno",
    docsTitle: "Dokumenti i izvori", docsLede: "Otpremite statut, rešenje o registraciji, godišnji izveštaj ili projektni dokument, ili navedite svoj sajt. Tekst se čita u vašem pregledaču i jednom šalje AI modelu; sama datoteka se ne čuva. Profil se ne menja dok ne odobrite predloge.",
    upload: "Izaberite dokument (PDF, DOCX ili TXT)", reading: "Čitanje dokumenta…", sending: (i, n) => `Analiza dela ${i} od ${n}…`, scanned: "Iz ove datoteke nije moguće pročitati tekst. Verovatno je skenirana slika; OCR još nije dostupan. Otpremite tekstualni PDF ili Word datoteku, ili unesite podatke u profil.",
    tooLong: (n, max) => `Dokument je dugačak: analizira se samo prvih ${max} delova (${n} znakova).`,
    webTitle: "Čitanje sa vašeg sajta", webLede: "Čitamo stranicu koju navedete i najviše dve povezane stranice o organizaciji („O nama“, „Misija“, „Projekti“) na istom sajtu, uz poštovanje robots.txt. Predlažu se samo podaci citirani sa tih stranica.", url: "Adresa sajta ili stranice", readSite: "Pročitaj sajt",
    review: "Pregled predloženih polja", reviewLede: "Uz svaku vrednost stoji rečenica iz koje je preuzeta. Vrednosti koje citat ne potvrđuje jasno, ili koje profil već ima, nisu označene; proverite ih sami. Liste se dodaju na ono što profil već ima.",
    field: "Polje", proposed: "Predložena vrednost", current: "Trenutna vrednost", evidence: "Citat iz izvora", conf: "Pouzdanost", found: "Citat pronađen u izvoru", notFound: "Citat NIJE pronađen u izvoru", valueNotInQuote: "Citat je pronađen, ali vrednost u njemu nije napisana", weakQuote: "Citat je pronađen, ali ne navodi jasno ovu vrednost", adds: (v) => `Dodaje: ${v}`, alreadyHas: "Već postoji u profilu", same: "Isto kao u profilu",
    apply: "Primeni označeno na profil", discard: "Odbaci", applied: (n) => `Dodato polja u profil: ${n}.`, runs: "Ranija izdvajanja", status: { review: "za pregled", applied: "primenjeno", discarded: "odbačeno" }, del: "Obriši", open: "Otvori",
    confL: { high: "visoka", medium: "srednja", low: "niska" }, dropped: (n) => `Uklonjeno predloženih vrednosti: ${n} (neispravne ili sa ličnim podacima).`, noQuote: (n) => `Izostavljeno vrednosti bez citata iz izvora: ${n}.`,
    matchTitle: "Provera podobnosti", matchLede: (n, d) => `${n} otvorenih i najavljenih poziva provereno u odnosu na vaš profil (podaci od ${d}). Provera po pravilima: prvo obavezni uslovi, zatim ponderisana ocena kompatibilnosti.`,
    scoreLegend: "Boje ocene: crvena 0–49%, žuta 50–74%, zelena 75–100%. Boja prikazuje samo ocenu kompatibilnosti; da li ste podobni određuju obavezni uslovi (oznaka statusa).", tierL: { high: "75–100%", medium: "50–74%", low: "0–49%" },
    notice: "Kompatibilnost je procena, a ne pravna odluka o podobnosti niti verovatnoća finansiranja. Merodavna su zvanična dokumenta poziva.",
    fStatus: "Svi statusi", fProg: "Svi programi", fDl: "Bilo koji rok", dl30: "Narednih 30 dana", dl60: "Narednih 60 dana", dl120: "Narednih 120 dana", onlyHigh: "Samo 75%+", sortScore: "Redosled: kompatibilnost", sortDl: "Redosled: rok",
    showing: (n, m) => `${n} od ${m} poziva`, more: "Prikaži još", strengths: "Prednosti", problems: "Mogući problemi", missing: "Nedostajući podaci", next: "Sledeći korak", report: "Detaljna procena", official: "Zvanična stranica",
    deadline: "Rok", funding: "Iznos", notStated: "Uslov nije naveden", missingCall: "Profil sadrži podatke koje ova procena koristi za ovaj poziv.", perGrant: "po grantu", topicBudget: "ukupan budžet teme", programme: "Program", noCountry: "Dodajte državu i tip organizacije u profil: bez njih nijedan poziv ne može da se proveri.",
    statusL: { eligible: "Podobna prema dostupnim podacima", potential: "Moguće podobna: potrebna provera", ineligible: "Nije podobna: obavezan uslov nije ispunjen", insufficient: "Nedovoljno podataka" },
    bandL: { excellent: "Odlična kompatibilnost", strong: "Velika kompatibilnost", moderate: "Umerena kompatibilnost", low: "Niska kompatibilnost", verylow: "Veoma niska kompatibilnost" },
    repA: "A. Ukupna procena", repB: "B. Provereni uslovi", repB2: "Kompatibilnost po dimenzijama", repC: "C. Prednosti organizacije", repD: "D. Nedostaci u podobnosti", repE: "E. Podaci koji nedostaju", repF: "F. Preporuke",
    requirement: "Uslov", result: "Rezultat", basis: "Osnov", weight: "Ponder", part: "Ocena",
    resL: { pass: "Ispunjen", fail: "Nije ispunjen", warn: "Mogući problem", unknown: "Za proveru", missing: "Nedostaju podaci u profilu" },
    srcL: { "programme-list": "lista zemalja učesnica Evropske komisije", call: "tekst poziva", source: "izvor poziva", derived: "pravila Eligible Calls nad tekstom poziva", "call-rule": "citiran zvanični tekst", none: "izvorni podaci" },
    capNote: "Ocena je ograničena jer poziv ima malo dodirnih tačaka sa vašim oblastima i ciljevima.",
    assessedAt: (d, v, g) => `Procenjeno ${d} na verziji profila ${v} i podacima o pozivima od ${g}. Procena se ponovo računa pri svakoj izmeni profila ili podataka o pozivu.`,
    explain: { eligible: "Nijedan obavezan uslov nije prekršen prema dostupnim podacima i svi provereni uslovi su ispunjeni.", potential: "Nijedan obavezan uslov nije prekršen, ali neke treba proveriti u dokumentu poziva ili dopuniti profil.", ineligible: "Najmanje jedan obavezan uslov nije ispunjen. Ocena kompatibilnosti je samo informativna.", insufficient: "Za proveru podobnosti potrebni su država i tip organizacije." },
    dims: { orgType: "Tip i pravni status organizacije", country: "Država i geografska podobnost", objectives: "Usklađenost sa ciljevima poziva", experience: "Iskustvo i prethodni projekti", targetGroups: "Ciljne grupe i korisnici", capacity: "Operativni i administrativni kapacitet", partnerships: "Partnerstva i međunarodna saradnja" },
    evalTitle: "Kriterijumi ocenjivanja", evalLede: "Kako se predlozi boduju, prema zvaničnim dokumentima: Opšti aneks D programa Horizont Evropa, dokument svakog poziva, stranica finansijera i Vodič kroz program Erasmus+. Podobnost (smemo li da apliciramo?) i kvalitet (da li bi ocenjivači dobro ocenili predlog?) su odvojena pitanja: podobna organizacija i dalje može podneti slab predlog.",
    evalTabCalls: "Po pozivu", evalCallsNote: "Vaši otvoreni pozivi, najkompatibilniji prvi. Kriterijumi su navedeni na engleskom, jeziku zvaničnih dokumenata; merodavna su dokumenta samog poziva.", progL: "Program",
    evalShowIneligible: "Prikaži i pozive na koje ne možete da aplicirate", evalCount: (n, k) => `Poziva: ${n}; za ${k} kriterijumi su prikazani ovde, za ostale poziv navodi gde se nalaze.`,
    kindL: { framework: "Opšti aneks D", document: "Dokument poziva", page: "Stranica finansijera", pointer: "Videti poziv" }, openReport: "Detaljan izveštaj",
    critNone: "Nema podataka o kriterijumima ocenjivanja za ovaj poziv.", fromCallPage: "Posebno za ovaj poziv (stranica poziva):",
    critFromAnnex: (row) => `Opšti aneks D programa Horizont Evropa, red „${row}“.`, heAnnex: "Opšti aneks D", critFromDoc: "Odeljak „Award criteria“ dokumenta poziva", callDoc: "Dokument poziva", evalForm: "Obrazac za ocenjivanje",
    critFromPage: (src) => `Stranica poziva (${src}), odeljak „How we will assess your application“.`, critPointer: "Kriterijumi nisu objavljeni u obliku koji ovaj sajt može da pročita. Nalaze se u dokumentima samog poziva.", critPointerNote: "Stranica poziva navodi gde su kriterijumi:",
    criterion: "Kriterijum", minPass: "Minimum", maxScore: "Maksimum", fullText: "Ceo tekst kriterijuma",
    scoreOf5: "ocena 0–5", iaWeight: "Uticaj se množi sa 1,5 za rangiranje (inovacione akcije)", heThresholds: "Svaki kriterijum 0–5 · prag 3 · ukupni prag 10 od 15", twoStageChip: "Poziv u dve faze",
    stage1Short: "1. faza", stage1Mark: "Ocenjuje se i u prvoj fazi poziva u dve faze (podebljano u aneksu)", stage1Note: "U prvoj fazi poziva u dve faze boduju se samo Izvrsnost i Uticaj, i to aspekti označeni sa „1. faza“, uz prag 4 za svaki.",
    heScoringTitle: "Ocene i pragovi", heTwoStageTitle: "Pozivi u dve faze", openCallsUsing: (n) => `Otvorenih poziva na Eligible Calls koji se ovako ocenjuju: ${n}.`,
    heOwn: "Akcije Marija Sklodovska-Kiri, Evropski istraživački savet, Evropski savet za inovacije, nagrade i neki pozivi partnerstava imaju sopstvene kriterijume; njihovi pozivi upućuju na njih u delu „Po pozivu“.",
    retrieved: (d) => `preuzeto ${d}`, repEval: "Kako se ovaj poziv ocenjuje", critNotice: "Pomoć za preliminarnu samoprocenu. Merodavni su program rada i dokumenta samog poziva.",
    guide: (y, v) => `Vodič kroz program ${y}, ${String(v).replace(/^Version (\d+) of /, "verzija $1 od ")}`, guideNotice: "Pomoć za preliminarnu samoprocenu. Ocenjivači boduju prema zvaničnom vodiču za godinu poziva; vodič je merodavan.", maxPts: (m, n) => `najviše ${m} bodova · najmanje ${n}`, totalMin: (n) => `Predlog mora imati najmanje ${n} bodova ukupno i najmanje polovinu maksimuma po svakom kriterijumu.`,
    rounds: "Rokovi u ovom vodiču (nacionalne agencije)", optional: "ako ga nacionalna agencija organizuje", where: "Prijava se podnosi Erasmus+ nacionalnoj agenciji vaše zemlje.", na: "Nacionalne agencije",
    ideasTitle: "Projektne ideje", ideasLede: "Koncepti projekata koje vaša organizacija može da razvije, svaki vezan za otvoren poziv sa Eligible Calls. Piše ih AI model na osnovu sačuvanog profila i poziva koje izaberete; pozivi, rokovi, podobnost i ocene kompatibilnosti potiču iz podataka i pravila platforme.",
    ideasAi: "Predlog koji je napisao AI: proverite ga u dokumentaciji poziva pre nego što se na njega oslonite.", ideasPick: "Pozivi za ideje", ideasPickNote: (n) => `Vaši najkompatibilniji otvoreni pozivi: podobni ili za proveru, sa ocenom od najmanje 50%. U jednom pokretanju može se koristiti najviše ${n}.`,
    ideasNoCalls: "Nijedan otvoren poziv još nema 50% kompatibilnosti sa profilom. Dopunite profil ili pogledajte stranicu provere podobnosti.", ideasNeed: "Za ideje profil mora imati naziv, tip organizacije, državu i opis, misiju ili ciljeve.",
    ideasGenerate: "Napravi ideje", ideasRegenerate: "Napravi nove ideje", ideasBusy: "Pišem ideje… to može trajati do jednog minuta.", ideasUse: "Troši jednu od vaših dnevnih AI akcija. Nesačuvani predlozi se zamenjuju; sačuvane ideje ostaju.",
    ideasDone: (n, d) => `Napravljeno ideja: ${n}.` + (d ? ` Odbačeno predloga: ${d} (naveli su poziv koji nije izabran ili su bili nepotpuni).` : ""), ideasZero: "Model nije našao izabran poziv koji zaista odgovara profilu. Probajte druge pozive ili dopunite profil.",
    ideasNone: "Još nema ideja.", ideasSaved: "Sačuvane ideje", ideasSuggested: "Najnoviji predlozi", ideasViewerNote: "Možete da čitate ideje. Urednici i vlasnici ih prave, čuvaju i dopisuju beleške.",
    ideaSavedChip: "Sačuvano", ideaSave: "Sačuvaj", ideaUnsave: "Ukloni iz sačuvanih", ideaNotes: "Beleške", ideaNotesSave: "Sačuvaj beleške", ideaNotesSaved: "Beleške su sačuvane.", ideaCompare: "Uporedi", ideaDelete: "Obriši",
    ideaF: { concept: "Koncept projekta", problem: "Problem koji se rešava", solution: "Predloženo rešenje", objectives: "Glavni ciljevi", targetGroups: "Ciljne grupe", activities: "Predložene aktivnosti", expectedResults: "Očekivani rezultati i uticaj", potentialPartners: "Mogući partneri", whyItFits: "Zašto ovaj projekat ima smisla" },
    ideaCall: "Odgovarajući poziv", compatRule: "Kompatibilnost organizacije i poziva (pravila)", conceptFitL: "Uklapanje koncepta (AI procena)", fitTitle: "AI ocene (1–5)",
    fitL: { alignment: "Usklađenost sa pozivom", priorities: "Prioriteti programa", feasibility: "Izvodljivost", impact: "Mogući uticaj" },
    ideaStale: (v) => `Napravljeno na osnovu verzije profila ${v}; profil je od tada izmenjen.`, ideaClosed: "Ovaj poziv više nije otvoren.", ideaGen: (d, sc) => `Napravljeno ${d}; kompatibilnost tada ${sc}%.`,
    compareTitle: "Poređenje", compareHint: "Označite Uporedi na dve ili tri ideje da ih vidite jednu pored druge.", compareMax: "Možete uporediti najviše tri ideje.", savedIdeasN: "Sačuvane projektne ideje",
    reportsTitle: "Sačuvani izveštaji", reportsSoon: "Čuvanje i izvoz izveštaja dolazi uz asistenta za ocenjivanje (sledeća faza). Procene se računaju uživo na stranici provere podobnosti.",
    settingsTitle: "Podešavanja", members: "Članovi", invite: "Dodajte člana preko e-mail adrese", role: "Uloga", roles: { owner: "Vlasnik", editor: "Urednik", viewer: "Posmatrač" }, add: "Dodaj",
    invited: "Pozvan (još nije registrovan)", remove: "Ukloni", leave: "Napusti ovu organizaciju", versions: "Istorija profila", changedF: "Izmenjena polja", by: "",
    account: "Vaš nalog", newsToggle: "E-mail vesti", deleteAccount: "Obriši moj nalog", deleteAccountNote: "Briše vaš nalog, sesije prijave i organizacije u kojima ste jedini član.", deleteAccountConfirm: "Da, trajno obriši moj nalog", cancel: "Otkaži", signedInAs: (e) => `Prijavljeni ste kao ${e}`,
    deleteOrg: "Obriši ovu organizaciju", deleteOrgNote: (n) => `Briše profil, njegovu istoriju i sve rezultate izdvajanja. Upišite naziv organizacije (${n}) da potvrdite.`, confirmDel: "Trajno obriši",
    errors: { signin: "Prijavite se.", role: "Vaša uloga to ne dozvoljava.", not_found: "Nije pronađeno ili nemate pristup.", email: "Unesite ispravnu e-mail adresu.", terms: "Prihvatite obaveštenje o privatnosti.", verification: "Provera protiv botova nije uspela. Osvežite stranicu i pokušajte ponovo.", too_many: "Previše zahteva za danas. Pokušajte sutra.", email_unavailable: "E-mail za prijavu trenutno ne može da se pošalje.", ai_user_limit: "Iskoristili ste današnje AI akcije. Obnavljaju se u ponoć po UTC.", ai_resting: "Današnja AI kvota je potrošena. Obnavlja se u ponoć po UTC.", ai_busy: "AI servis je zauzet. Pokušajte za minut.", ai_unavailable: "AI servis nije odgovorio. Pokušajte kasnije.", ai_bad_answer: "Odgovor AI modela nije moguće pročitati. Pokušajte ponovo.", url_invalid: "Unesite javnu veb-adresu (https://…).", robots_disallow: "robots.txt ovog sajta ne dozvoljava automatsko čitanje stranice.", page_unavailable: "Stranicu nije moguće otvoriti.", pdf_upload_instead: "Ova adresa je PDF: preuzmite ga i otpremite kao dokument.", unsupported_type: "Ova adresa nije veb-stranica.", page_empty: "Na stranici nema čitljivog teksta.", text_too_short: "Premalo teksta za analizu.", last_owner: "Organizacija mora imati bar jednog vlasnika.", transfer_ownership: "Prvo dodelite ulogu vlasnika drugom članu zajedničkih organizacija.", version_conflict: "Neko drugi je u međuvremenu sačuvao profil.", too_many_orgs: "Dostigli ste broj organizacija po nalogu.", google_off: "Prijava preko Google naloga još nije podešena na ovom sajtu.", google_cancelled: "Prijava preko Google naloga je otkazana.", google_state: "Prijava je trajala predugo ili je otvorena u drugoj kartici. Pokušajte ponovo.", google_failed: "Prijava preko Google naloga nije uspela. Pokušajte ponovo.", google_unverified: "Google nije potvrdio ovu e-mail adresu.", email_login_off: "Prijava linkom preko e-pošte nije dostupna.", server_error: "Greška na serveru.", csrf: "Zahtev je blokiran kao međusajtni. Osvežite stranicu.", db_unavailable: "Baza podataka nije povezana.", network: "Nema veze sa serverom.", ideas_limit: "Vaša organizacija je danas iskoristila pravljenje ideja. Pokušajte sutra.", no_calls: "Nijedan izabrani poziv nije otvoren za vašu organizaciju.", profile_incomplete: "Prvo dopunite profil: naziv, tip, država i opis.", data_unavailable: "Podaci o pozivima nisu mogli da se učitaju. Pokušajte kasnije." },
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
    "str.experience": (p) => `Experience as ${p.role} in ${p.programme === "ERASMUS" ? "Erasmus+" : "EU-funded"} projects.`, "str.capacity": () => "Team size fits the size of the grant.", "str.country": (p) => `${ccName(p.cc)} is fully eligible.`,
    "rec.notEligible": () => "A mandatory requirement is not met. Unless the call document says otherwise, focus on other calls.", "rec.complete": (p) => `Complete the profile: ${listOf(p.fields, fieldName)}.`,
    "rec.checkCountry": (p) => `Read the eligible-countries section of the call for ${ccName(p.cc)}.`, "rec.checkApplicant": () => "Confirm in the call conditions that your type of organisation can apply.",
    "rec.partners": (p) => `Find partners${p.need ? ` from at least ${p.need} other eligible countries` : ""} well before the deadline.`, "rec.rule": () => "Verify the quoted requirement in the official text.",
    "rec.groups": () => "Explain in the proposal how your target groups relate to the beneficiaries named in the call.", "rec.readDocument": () => "The source shows only part of the conditions: read the call document.", "rec.officialPage": () => "Open the official call page; it prevails over this assessment.",
  },
  sr: {
    "country.Y": (p) => `${ccName(p.cc)} je podobna.`, "country.P": (p) => `${ccName(p.cc)} je podobna uz uslov. ${p.reason}`, "country.C": (p) => `Podobnost za ${ccName(p.cc)} nije navedena u izvornim podacima. ${p.reason}`,
    "country.N": (p) => `${ccName(p.cc)} nije podobna. ${p.reason}`, "country.notListed": (p) => `Nema podataka o podobnosti za ${ccName(p.cc)}.`, "country.missing": () => "U profilu nedostaje država sedišta.",
    "applicant.listed": (p) => `Tip vaše organizacije je među podnosiocima za ovaj poziv (${listOf(p.listed, appName)}). ${p.note || ""}`, "applicant.notStated": () => "Podaci o pozivu ne navode tipove podnosilaca.",
    "applicant.informal": () => "Neformalna grupa nije pravno lice: proverite da li poziv prihvata takve podnosioce.", "applicant.individualsOnly": (p) => `Poziv je namenjen pojedincima (${listOf(p.listed, appName)}), ne organizacijama.`,
    "applicant.notListed": (p) => `Tip vaše organizacije nije među navedenim podnosiocima (${listOf(p.listed, appName)}). Proverite uslove poziva.`, "applicant.missing": () => "U profilu nedostaje tip organizacije.",
    "partnership.individual": () => "Samo pojedinačne prijave.", "partnership.alone": () => "Može da aplicira jedan podnosilac.", "partnership.unspecified": () => "Podaci o pozivu ne navode uslov konzorcijuma. Proverite uslove poziva.",
    "partnership.consortiumMet": (p) => `Potreban konzorcijum: profil navodi partnere u ${p.have} drugih zemalja (potrebno: ${p.need}).`,
    "partnership.consortiumGap": (p) => `Potreban konzorcijum${p.need ? `: partneri iz najmanje ${p.need} druge podobne zemlje` : ""}. Profil navodi partnere u ${p.have}. ${p.note || ""}`,
    "partnership.consortiumMissing": (p) => `Potreban konzorcijum; profil nema podatke o partnerima. ${p.note || ""}`,
    "rule.established.pass": (p) => `Pravno osnovana najmanje ${p.years} godine pre roka: osnovana ${p.year}.`, "rule.established.fail": (p) => `Mora biti pravno osnovana najmanje ${p.years} godine pre roka (${String(p.deadline).slice(0, 10)}); osnovana ${p.year}.`,
    "rule.established.date": (p) => `Mora biti pravno osnovana najmanje ${p.years} godine pre roka (${String(p.deadline).slice(0, 10)}); osnovana ${p.year}: odlučuje tačan datum registracije.`, "rule.established.missing": (p) => `Mora biti pravno osnovana najmanje ${p.years} godine pre roka; godina osnivanja nedostaje.`,
    "rule.engo": () => "Podnosilac mora biti evropska nevladina organizacija aktivna u obrazovanju i obuci ili radu sa mladima.", "rule.heis.warn": () => "Ova aktivnost je namenjena visokoškolskim ustanovama, a vaša organizacija to nije. To može diskvalifikovati prijavu: proverite dokument poziva.",
    "rule.heis.pass": () => "Visokoškolska ustanova, kako aktivnost zahteva.", "rule.heis.missing": () => "Tip organizacije nedostaje; aktivnost je namenjena visokoškolskim ustanovama.",
    "str.sectors": (p) => `Zajedničke oblasti delovanja: ${listOf(p.sectors, sectorName)}.`, "str.words": (p) => `Reči zajedničke sa tekstom poziva: ${p.words.join(", ")}.`, "str.groups": (p) => `Poziv pominje vaše ciljne grupe: ${listOf(p.groups, groupName)}.`,
    "str.experience": (p) => `Iskustvo kao ${p.role === "coordinator" ? "koordinator" : "partner"} u ${p.programme === "ERASMUS" ? "Erasmus+" : "EU"} projektima.`, "str.capacity": () => "Veličina tima odgovara veličini granta.", "str.country": (p) => `${ccName(p.cc)} je u potpunosti podobna.`,
    "rec.notEligible": () => "Obavezan uslov nije ispunjen. Osim ako dokument poziva ne kaže drugačije, usmerite se na druge pozive.", "rec.complete": (p) => `Dopunite profil: ${listOf(p.fields, fieldName)}.`,
    "rec.checkCountry": (p) => `Pročitajte deo poziva o podobnim zemljama za ${ccName(p.cc)}.`, "rec.checkApplicant": () => "Potvrdite u uslovima poziva da vaš tip organizacije može da aplicira.",
    "rec.partners": (p) => `Pronađite partnere${p.need ? ` iz najmanje ${p.need} druge podobne zemlje` : ""} na vreme pre roka.`, "rec.rule": () => "Proverite citirani uslov u zvaničnom tekstu.",
    "rec.groups": () => "U predlogu objasnite kako su vaše ciljne grupe povezane sa korisnicima koje poziv navodi.", "rec.readDocument": () => "Izvor prikazuje samo deo uslova: pročitajte dokument poziva.", "rec.officialPage": () => "Otvorite zvaničnu stranicu poziva; ona je merodavna.",
  },
};
const codeText = (x) => { const f = CODES[L()][x.code] || CODES.en[x.code]; return f ? f(x.params || {}).trim() : x.code; };

/* ---------- API ---------- */
async function api(method, path, body) {
  let r;
  try { r = await fetch("/api" + path, { method, credentials: "same-origin", headers: { "content-type": "application/json", "x-requested-with": "eligiblecalls" }, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw Object.assign(new Error("network"), { status: 0 }); }
  let j = null; try { j = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) throw Object.assign(new Error((j && j.error) || "server_error"), { status: r.status, data: j });
  return j;
}

/* ---------- state ---------- */
const ST = { me: undefined, org: null, results: null, resultsKey: "", stats: null, statsGen: "", filters: { status: "", prog: "", dl: "", high: false, sort: "score", shown: 30 }, review: null, guide: null };
const app = () => document.getElementById("app");
const go = (h) => { if (location.hash === "#" + h) EC.route(); else location.hash = h; };
const fmtTime = (ms) => new Intl.DateTimeFormat(L() === "sr" ? "sr-Latn-RS" : "en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));

async function loadMe(force) { if (ST.me === undefined || force) { try { ST.me = await api("GET", "/me"); } catch (e) { ST.me = { user: null, error: e.message }; } } return ST.me; }
async function loadOrg(id, force) {
  if (!force && ST.org && ST.org.id === id) return ST.org;
  ST.org = await api("GET", "/orgs/" + id); ST.review = null;
  try { localStorage.setItem("konkursi.org", JSON.stringify(id)); } catch {}
  return ST.org;
}
const canEdit = () => ST.org && (ST.org.role === "owner" || ST.org.role === "editor");

function activeCalls() { return (EC.CALLS || []).filter((c) => EC.isOpen(c)); }
function results() {
  const calls = activeCalls();
  const key = ST.org.id + "@" + ST.org.version + "@" + EC.META.generated + "@" + calls.length;
  if (ST.resultsKey === key && ST.results) return ST.results;
  if (ST.statsGen !== EC.META.generated) { ST.stats = buildDF(calls); ST.statsGen = EC.META.generated; }
  const byId = new Map(calls.map((c) => [c.id, c]));
  ST.results = assessAll(ST.org.profile, calls, { stats: ST.stats }).map((r) => ({ ...r, call: byId.get(r.callId) }));
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
    const id = parts[1], sec = parts[2] || "overview", arg = parts.slice(3).join("/");
    shell(id, sec, `<div class="loading">…</div>`);
    await loadOrg(id);
    const body = await ({ overview: secOverview, profile: secProfile, documents: secDocuments, matching: secMatching, match: secReport, ideas: secIdeas, evaluation: secEvaluation, reports: secReports, settings: secSettings }[sec] || secOverview)(arg);
    shell(id, sec === "match" ? "matching" : sec, body);
    afterRender[sec] && afterRender[sec](arg);
  } catch (e) {
    if (e.status === 401) { ST.me = undefined; return renderLogin(null, (await loadMe(true)).signin); }
    app().innerHTML = `<div class="wrap page"><h1>${esc(T("title"))}</h1><p class="note err">${esc(errText(e))}</p><p><a href="#org">${esc(T("nav.overview"))}</a></p></div>`;
  }
}

function shell(id, sec, body) {
  const me = ST.me, org = ST.org && ST.org.id === id ? ST.org : null;
  const items = ["overview", "profile", "documents", "matching", "ideas", "evaluation", "reports", "settings"];
  const soon = new Set(["reports"]);
  app().innerHTML = `<div class="wrap oi">
    <aside class="oi-side">
      <div class="oi-org"><span class="eyebrow">${esc(T("title"))}</span><span class="n">${esc(org ? org.name : "")}</span>
        ${me.orgs.length > 1 ? `<select id="oiSwitch" aria-label="Organisation">${me.orgs.map((o) => `<option value="${o.id}"${o.id === id ? " selected" : ""}>${esc(o.name)}</option>`).join("")}</select>` : ""}
        <span class="fine">${esc(me.user.email)}${org ? " · " + esc(T("roles." + org.role)) : ""}</span></div>
      <nav class="oi-nav" aria-label="${esc(T("title"))}">${items.map((s) => `<a href="#org/${id}/${s}"${s === sec ? ' aria-current="page"' : ""}>${esc(T("nav." + s))}${soon.has(s) ? `<span class="soon">${esc(T("soon"))}</span>` : ""}</a>`).join("")}</nav>
      <div class="fine"><a href="#org/new">${esc(T("newOrg"))}</a> · <button type="button" class="linkbtn" id="oiOut">${esc(T("signOut"))}</button></div>
    </aside>
    <div class="oi-main">${body}</div></div>`;
  const sw = document.getElementById("oiSwitch"); if (sw) sw.addEventListener("change", () => go("org/" + sw.value + "/" + sec));
  bindAccount();
}
const afterRender = {};

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
async function secOverview() {
  const org = ST.org, p = org.profile, c = completeness(p);
  let savedIdeas = 0; try { savedIdeas = (await api("GET", `/orgs/${org.id}/ideas`)).ideas.filter((x) => x.status === "saved").length; } catch { /* shown as 0 */ }
  const res = results();
  const ok = res.filter((r) => r.status === "eligible" || r.status === "potential");
  const high = ok.filter((r) => r.score >= 75);
  const now = Date.now();
  const soon = ok.filter((r) => r.score >= 60).map((r) => ({ r, dl: EC.nextDl(r.call) })).filter((x) => x.dl).sort((a, b) => a.dl.localeCompare(b.dl)).slice(0, 6);
  const strengths = [];
  if (p.activityAreas && p.activityAreas.length) strengths.push(`${T("dims.objectives")}: ${listOf(p.activityAreas, sectorName)}`);
  if (p.targetGroups && p.targetGroups.length) strengths.push(`${T("dims.targetGroups")}: ${listOf(p.targetGroups, groupName)}`);
  if (p.euFunding === "coordinator" || p.erasmus === "coordinator") strengths.push(nm(FIELD.euFunding) + ": " + nm(EXPERIENCE.find((x) => x.id === "coordinator")));
  if (p.partnerCountries && p.partnerCountries.length) strengths.push(`${nm(FIELD.partnerCountries)}: ${listOf(p.partnerCountries, ccName)}`);
  return `<h1>${esc(org.name)}</h1>
    ${!p.country || !p.orgType ? `<p class="note warn">${esc(T("noCountry"))} <a href="#org/${org.id}/profile">${esc(T("fillProfile"))}</a></p>` : ""}
    <div class="oi-grid">
      <div class="stat"><span class="l">${esc(T("complete"))}</span><span class="v">${c.pct}%</span>${meter(c.pct)}</div>
      <div class="stat"><span class="l">${esc(T("analysed"))}</span><span class="v">${res.length}</span></div>
      <div class="stat"><span class="l">${esc(T("high"))}</span><span class="v">${high.length}</span></div>
      <div class="stat"><span class="l">${esc(T("eligibleN"))}</span><span class="v">${res.filter((r) => r.status === "eligible").length}</span></div>
      <a class="stat" href="#org/${org.id}/ideas"><span class="l">${esc(T("savedIdeasN"))}</span><span class="v">${savedIdeas}</span></a>
    </div>
    <div class="oi-card"><h2>${esc(T("upcoming"))}</h2>${soon.length ? `<div class="tw"><table class="oi-t upc"><tbody>${soon.map(({ r, dl }) => `<tr><td class="num">${esc(EC.fmtDate(dl))}</td><td><a href="#org/${org.id}/match/${encodeURIComponent(r.call.key)}">${esc(r.call.title)}</a><div class="fine">${esc((EC.P[r.call.programme] || {}).short || r.call.programmeName || "")}</div></td><td class="num">${scoreNum(r.score)}</td><td>${statusBadge(r.status)}</td></tr>`).join("")}</tbody></table></div>` : `<p class="fine">${esc(T("none"))}</p>`}
      <p><a href="#org/${org.id}/matching">${esc(T("openMatching"))} →</a></p></div>
    <div class="oi-card"><h2>${esc(T("missingTitle"))}</h2>${c.missing.length ? `<p>${esc(listOf(c.missing.slice(0, 12), fieldName))}</p><p><a href="#org/${org.id}/profile">${esc(T("fillProfile"))} →</a></p>` : `<p class="fine">${esc(T("missingNone"))}</p>`}</div>
    <div class="oi-card"><h2>${esc(T("strengthsTitle"))}</h2>${strengths.length ? `<ul>${strengths.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : `<p class="fine">${esc(T("none"))}</p>`}</div>
    ${org.updatedAt ? `<p class="fine">${esc(T("lastUpdate", fmtTime(org.updatedAt), org.version))}</p>` : ""}`;
}

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
function secProfile() {
  const org = ST.org, p = org.profile, meta = p._meta || {}, dis = !canEdit();
  const wide = new Set(["long", "multi", "countries"]);
  return `<h1>${esc(T("nav.profile"))}</h1>${dis ? `<p class="note">${esc(T("viewerNote"))}</p>` : ""}
    <form class="form" id="oiProfile" novalidate>${Object.entries(GROUPS).map(([g, ids]) => `<fieldset><legend>${esc(T("sections." + g))}</legend>${ids.map((fid) => { const f = FIELD[fid]; return `<div class="fld${wide.has(f.kind) ? " wide" : ""}" data-f="${fid}"><${f.kind === "multi" || f.kind === "countries" ? "span class=\"lbl\"" : `label for="f_${fid}"`}>${esc(nm(f))} ${provBadge(meta[fid])}</${f.kind === "multi" || f.kind === "countries" ? "span" : "label"}>${input(f, p[fid], dis)}<span class="err" hidden></span></div>`; }).join("")}</fieldset>`).join("")}
    ${dis ? "" : `<div class="savebar"><button class="btn" type="submit">${esc(T("save"))}</button><span id="oiSaveMsg" class="fine" role="status"></span></div>`}</form>`;
}
afterRender.profile = () => {
  const form = document.getElementById("oiProfile"); if (!form || !canEdit()) return;
  const msg = document.getElementById("oiSaveMsg");
  form.addEventListener("input", () => { msg.textContent = T("unsaved"); });
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const org = ST.org, old = org.profile, meta = { ...(old._meta || {}) }, next = {};
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
    } catch (e) {
      if (e.message === "invalid" && e.data && e.data.fields) {
        for (const [k, code] of Object.entries(e.data.fields)) { const box = form.querySelector(`[data-f="${k}"] .err`); if (box) { box.hidden = false; box.textContent = code; } }
        msg.textContent = T("invalid");
      } else if (e.message === "version_conflict") msg.innerHTML = `${esc(T("conflict"))} <a href="#org/${org.id}/profile" id="oiReload">${esc(T("reload"))}</a>`;
      else msg.textContent = errText(e);
      const rl = document.getElementById("oiReload"); if (rl) rl.addEventListener("click", async (x) => { x.preventDefault(); await loadOrg(org.id, true); EC.route(); });
    }
  });
};

/* ---------- documents and web research ---------- */
const CHUNK = 14000, MAX_PARTS = 6;
async function readFileText(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "pdf" || file.type === "application/pdf") {
    await EC.loadScript(EC.PDFJS_WORKER); await EC.loadScript(EC.PDFJS);
    const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages && text.length < CHUNK * MAX_PARTS; i++) { const pg = await pdf.getPage(i); const tc = await pg.getTextContent(); text += tc.items.map((x) => x.str).join(" ") + "\n\n"; }
    return text;
  }
  if (ext === "docx") { await EC.loadScript(EC.MAMMOTH); return (await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value; }
  if (["txt", "md"].includes(ext) || file.type.startsWith("text/")) return file.text();
  throw new Error("type");
}
function splitText(text) {
  const parts = []; let i = 0;
  while (i < text.length && parts.length < MAX_PARTS) {
    let end = Math.min(text.length, i + CHUNK);
    if (end < text.length) { const cut = text.lastIndexOf("\n", end); if (cut > i + CHUNK * 0.6) end = cut; }
    parts.push(text.slice(i, end)); i = end;
  }
  return parts;
}
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
function mergedValue(k, proposed, current) { return isList(k) ? [...new Set([...(current || []), ...(proposed || [])])] : proposed; }
function newItems(k, proposed, current) { return isList(k) ? (proposed || []).filter((x) => !(current || []).includes(x)) : null; }
const sameValue = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
function quoteLabel(e) { return e.note === "value_not_in_evidence" ? T("valueNotInQuote") : e.note === "weak_evidence" ? T("weakQuote") : e.found ? T("found") : T("notFound"); }
function proposedText(k, e, current) {
  const add = newItems(k, e.value, current);
  if (add) return add.length ? (current && current.length ? T("adds", valueText(FIELD[k], add)) : valueText(FIELD[k], add)) : T("alreadyHas");
  return sameValue(e.value, current) ? `${valueText(FIELD[k], e.value)} (${T("same")})` : valueText(FIELD[k], e.value);
}
function preTicked(k, e, current) {
  if (!e.found || e.confidence === "low" || e.note) return false;
  const add = newItems(k, e.value, current);
  return add ? add.length > 0 : !sameValue(e.value, current);
}
function reviewHTML(rv) {
  const p = ST.org.profile, rows = Object.entries(rv.fields).filter(([k]) => FIELD[k]);
  const removed = (rv.dropped || []).filter((d) => d.why === "personal_data" || d.why === "invalid_value").length;
  const noQuote = (rv.dropped || []).filter((d) => d.why === "no_evidence").length;
  return `<div class="oi-card"><h2>${esc(T("review"))}: ${esc(rv.sourceName || "")}</h2><p class="fine">${esc(T("reviewLede"))}</p>
    ${removed ? `<p class="note">${esc(T("dropped", removed))}</p>` : ""}${noQuote ? `<p class="fine">${esc(T("noQuote", noQuote))}</p>` : ""}
    <div class="tw"><table class="oi-t"><thead><tr><th></th><th>${esc(T("field"))}</th><th>${esc(T("proposed"))}</th><th>${esc(T("current"))}</th><th>${esc(T("evidence"))}</th><th>${esc(T("conf"))}</th></tr></thead><tbody>
    ${rows.map(([k, e]) => `<tr><td><input type="checkbox" data-take="${k}"${preTicked(k, e, p[k]) && canEdit() ? " checked" : ""}${canEdit() ? "" : " disabled"} aria-label="${esc(fieldName(k))}"></td><td>${esc(fieldName(k))}</td><td>${esc(proposedText(k, e, p[k]))}</td><td class="fine">${esc(valueText(FIELD[k], p[k]))}</td>
      <td><p class="quote">${esc(e.evidence)}</p><span class="res ${e.found && !e.note ? "pass" : "warn"}">${esc(quoteLabel(e))}</span>${e.sourceUrl ? ` · <a class="fine" href="${esc(e.sourceUrl)}" target="_blank" rel="noopener">${esc(new URL(e.sourceUrl).pathname)}</a>` : ""}</td><td>${esc(T("confL." + e.confidence))}</td></tr>`).join("")}
    </tbody></table></div>
    ${canEdit() ? `<div class="oi-row"><button class="btn" id="oiApply" type="button">${esc(T("apply"))}</button><button class="btn ghost" id="oiDiscard" type="button">${esc(T("discard"))}</button><span id="oiApplyMsg" role="status"></span></div>` : ""}</div>`;
}
async function secDocuments() {
  const org = ST.org, dis = !canEdit();
  let runs = [];
  try { runs = (await api("GET", `/orgs/${org.id}/extractions`)).extractions; } catch { /* shown empty */ }
  ST.runs = runs;
  return `<h1>${esc(T("docsTitle"))}</h1><p class="lede">${esc(T("docsLede"))}</p>${dis ? `<p class="note">${esc(T("viewerNote"))}</p>` : ""}
    ${dis ? "" : `<div class="drop"><label class="btn quiet" for="oiFile">${esc(T("upload"))}</label><input type="file" id="oiFile" accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" hidden><div class="progress" id="oiProg" role="status"></div></div>
    <form class="oi-card" id="oiWeb"><h2>${esc(T("webTitle"))}</h2><p class="fine">${esc(T("webLede"))}</p><div class="fld"><label for="oiUrl">${esc(T("url"))}</label><input type="url" id="oiUrl" placeholder="https://" value="${esc(org.profile.website || "")}"></div><div><button class="btn" type="submit">${esc(T("readSite"))}</button></div><div class="progress" id="oiWebMsg" role="status"></div></form>`}
    <div id="oiReview">${ST.review ? reviewHTML(ST.review) : ""}</div>
    <div class="oi-card"><h2>${esc(T("runs"))}</h2>${runs.length ? `<table class="oi-t"><tbody>${runs.map((r) => `<tr><td>${esc(fmtTime(r.at))}</td><td>${esc(r.sourceName)}${r.sourceUrl ? ` <a class="fine" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">↗</a>` : ""}<div class="fine">${Object.keys(r.fields).length} · ${esc(T("status." + r.status))}</div></td><td><button type="button" class="linkbtn" data-open="${r.id}">${esc(T("open"))}</button>${dis ? "" : ` · <button type="button" class="linkbtn" data-del="${r.id}">${esc(T("del"))}</button>`}</td></tr>`).join("")}</tbody></table>` : `<p class="fine">${esc(T("none"))}</p>`}</div>`;
}
afterRender.documents = () => {
  const org = ST.org;
  const bindReview = () => {
    const box = document.getElementById("oiReview");
    box.innerHTML = ST.review ? reviewHTML(ST.review) : "";
    const ap = document.getElementById("oiApply"); if (!ap) return;
    ap.addEventListener("click", async () => {
      const rv = ST.review, take = [...box.querySelectorAll("[data-take]:checked")].map((x) => x.dataset.take);
      const prof = JSON.parse(JSON.stringify(ST.org.profile)); prof._meta = prof._meta || {};
      for (const k of take) {
        const e = rv.fields[k];
        prof[k] = mergedValue(k, e.value, prof[k]);
        prof._meta[k] = { source: rv.kind === "web" ? "web" : "document", sourceName: rv.sourceName, ...(e.sourceUrl ? { sourceUrl: e.sourceUrl } : {}), evidence: e.evidence, confidence: e.confidence, verified: true, at: new Date().toISOString() };
      }
      const m = document.getElementById("oiApplyMsg");
      try {
        await api("PUT", `/orgs/${org.id}/profile`, { profile: prof, baseVersion: ST.org.version, note: "extraction " + rv.sourceName });
        await api("PATCH", `/orgs/${org.id}/extractions/${rv.id}`, { status: "applied" });
        await loadOrg(org.id, true); ST.review = null; ST.me = undefined; await loadMe();
        m.className = "note ok"; m.textContent = T("applied", take.length);
        setTimeout(() => EC.route(), 900);
      } catch (e) { m.className = "note err"; m.textContent = errText(e); }
    });
    document.getElementById("oiDiscard").addEventListener("click", async () => { await api("PATCH", `/orgs/${org.id}/extractions/${ST.review.id}`, { status: "discarded" }).catch(() => {}); ST.review = null; EC.route(); });
  };
  bindReview();
  document.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => { const r = ST.runs.find((x) => x.id === b.dataset.open); ST.review = { ...r, dropped: [] }; bindReview(); document.getElementById("oiReview").scrollIntoView({ behavior: "smooth" }); }));
  document.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => { await api("DELETE", `/orgs/${org.id}/extractions/${b.dataset.del}`).catch(() => {}); if (ST.review && ST.review.id === b.dataset.del) ST.review = null; EC.route(); }));
  const file = document.getElementById("oiFile");
  if (file) file.addEventListener("change", async () => {
    const f = file.files[0]; if (!f) return;
    const prog = document.getElementById("oiProg"); prog.className = "progress"; prog.textContent = T("reading");
    try {
      let text = (await readFileText(f)).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
      if (text.replace(/\s/g, "").length < 200) { prog.className = "note warn"; prog.textContent = T("scanned"); return; }
      const parts = splitText(text);
      let runId = null, last = null; const dropped = [];
      for (let i = 0; i < parts.length; i++) {
        prog.textContent = T("sending", i + 1, parts.length);
        last = await api("POST", `/orgs/${org.id}/extract`, { sourceName: f.name, text: parts[i], part: i + 1, parts: parts.length, runId });
        runId = last.id; dropped.push(...(last.dropped || []));
      }
      prog.textContent = text.length > CHUNK * MAX_PARTS ? T("tooLong", CHUNK * MAX_PARTS, MAX_PARTS) : "";
      ST.review = { id: last.id, kind: "document", sourceName: f.name, fields: last.fields, dropped };
      bindReview();
    } catch (e) { prog.className = "note err"; prog.textContent = e.message === "type" ? T("upload") : errText(e); }
    file.value = "";
  });
  const web = document.getElementById("oiWeb");
  if (web) web.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const m = document.getElementById("oiWebMsg"); m.className = "progress"; m.textContent = "…";
    try {
      const r = await api("POST", `/orgs/${org.id}/research`, { url: document.getElementById("oiUrl").value });
      m.textContent = r.pages.join(" · ");
      ST.review = { id: r.id, kind: "web", sourceName: new URL(r.pages[0]).hostname, fields: r.fields, dropped: r.dropped };
      bindReview();
    } catch (e) { m.className = "note err"; m.textContent = errText(e); }
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
  const c = r.call, id = ST.org.id, dl = EC.nextDl(c);
  const probs = r.checks.filter((x) => x.result !== "pass").slice(0, 3);
  return `<article class="oi-card match-card"><div class="sc">${scoreNum(r.score)}${scoreMeter(r.score)}<span class="fine">${esc(T("bandL." + r.band))}</span></div>
    <div style="display:grid;gap:8px;min-width:0"><div class="oi-row">${statusBadge(r.status)}<span>${esc((EC.P[c.programme] || {}).short || c.programmeName || c.programme)}</span>${dl ? `<span>${esc(T("deadline"))}: <b>${esc(EC.fmtDate(dl))}</b> · <span data-dl="${esc(dl)}">${esc(EC.leftText(dl))}</span></span>` : ""}${fundingText(c) ? `<span>${esc(T("funding"))}: ${esc(fundingText(c))}</span>` : ""}</div>
    <h3><a href="#org/${id}/match/${encodeURIComponent(c.key)}">${esc(c.title)}</a></h3>
    <div class="cols">${r.strengths.length ? `<div><h4>${esc(T("strengths"))}</h4><ul>${r.strengths.slice(0, 2).map((s) => `<li>${esc(codeText(s))}</li>`).join("")}</ul></div>` : ""}
      ${probs.length ? `<div><h4>${esc(T("problems"))}</h4><ul>${probs.map((x) => `<li><span class="res ${x.result}">${esc(T("resL." + x.result))}</span> ${esc(codeText(x).slice(0, 220))}</li>`).join("")}</ul></div>` : ""}
      ${r.missing.length ? `<div><h4>${esc(T("missing"))}</h4><p class="fine">${esc(listOf(r.missing.slice(0, 5), fieldName))}</p></div>` : ""}
      <div><h4>${esc(T("next"))}</h4><p class="fine">${esc(codeText(r.next[0]))}</p></div></div>
    <div class="oi-row"><a class="btn quiet" href="#org/${id}/match/${encodeURIComponent(c.key)}">${esc(T("report"))}</a><a class="btn ext" href="${esc(c.url)}" target="_blank" rel="noopener">${esc(T("official"))} <span class="arr">↗</span></a></div></div></article>`;
}
function filtered() {
  const F = ST.filters, now = Date.now();
  let list = results().filter((r) => (!F.status || r.status === F.status) && (!F.prog || r.call.programme === F.prog) && (!F.high || r.score >= 75));
  if (F.dl) list = list.filter((r) => { const d = EC.nextDl(r.call); return d && Date.parse(d.slice(0, 10)) - now <= +F.dl * 864e5; });
  if (F.sort === "deadline") list = [...list].sort((a, b) => (EC.nextDl(a.call) || "9").localeCompare(EC.nextDl(b.call) || "9"));
  return list;
}
function secMatching() {
  const F = ST.filters, all = results(), list = filtered();
  const progs = [...new Set(all.map((r) => r.call.programme))].sort();
  const sel = (id, opts, v) => `<select id="${id}">${opts.map(([val, label]) => `<option value="${val}"${String(v) === String(val) ? " selected" : ""}>${esc(label)}</option>`).join("")}</select>`;
  return `<h1>${esc(T("matchTitle"))}</h1><p class="lede">${esc(T("matchLede", all.length, EC.fmtDate(EC.META.generated)))}</p>
    ${!ST.org.profile.country || !ST.org.profile.orgType ? `<p class="note warn">${esc(T("noCountry"))}</p>` : ""}
    <p class="note">${esc(T("notice"))}</p>
    <div class="tier-legend" aria-label="${esc(T("scoreLegend"))}">${["low", "medium", "high"].map((k) => `<span class="sc-chip t-${k}">${esc(T("tierL." + k))}</span>`).join("")}<span class="fine">${esc(T("scoreLegend"))}</span></div>
    <div class="oi-filters">${sel("ofStatus", [["", T("fStatus")], ...Object.keys(STATUS_ORDER).map((s) => [s, T("statusL." + s)])], F.status)}
      ${sel("ofProg", [["", T("fProg")], ...progs.map((p) => [p, (EC.P[p] || {}).short || p])], F.prog)}
      ${sel("ofDl", [["", T("fDl")], ["30", T("dl30")], ["60", T("dl60")], ["120", T("dl120")]], F.dl)}
      ${sel("ofSort", [["score", T("sortScore")], ["deadline", T("sortDl")]], F.sort)}
      <label class="tog"><input type="checkbox" id="ofHigh"${F.high ? " checked" : ""}> ${esc(T("onlyHigh"))}</label></div>
    <p class="fine">${esc(T("showing", Math.min(F.shown, list.length), list.length))}</p>
    <div class="match-list">${list.slice(0, F.shown).map(matchCard).join("")}</div>
    ${list.length > F.shown ? `<div><button class="btn ghost" id="ofMore">${esc(T("more"))}</button></div>` : ""}`;
}
afterRender.matching = () => {
  const F = ST.filters, re = () => { F.shown = 30; EC.route(); };
  const on = (id, k, f = (e) => e.value) => { const el = document.getElementById(id); if (el) el.addEventListener("change", () => { F[k] = f(el); re(); }); };
  on("ofStatus", "status"); on("ofProg", "prog"); on("ofDl", "dl"); on("ofSort", "sort"); on("ofHigh", "high", (e) => e.checked);
  const m = document.getElementById("ofMore"); if (m) m.addEventListener("click", () => { F.shown += 30; const y = scrollY; EC.route(); scrollTo(0, y); });
};

async function secReport(key) {
  const c = EC.BYKEY[decodeURIComponent(key)];
  if (!c) return `<p class="note err">${esc(T("errors.not_found"))}</p>`;
  const r = assess(ST.org.profile, c, { stats: ST.stats || buildDF(activeCalls()) });
  const dl = EC.nextDl(c), id = ST.org.id;
  const srcLabel = (s) => (s ? T("srcL." + s) : "");
  return `<a class="back" href="#org/${id}/matching">← ${esc(T("matchTitle"))}</a>
    <h1>${esc(c.title)}</h1>
    <div class="oi-row"><span>${esc((EC.P[c.programme] || {}).name || c.programmeName || "")}</span>${dl ? `<span>${esc(T("deadline"))}: <b>${esc(EC.fmtDate(dl))}</b></span>` : ""}${fundingText(c) ? `<span>${esc(T("funding"))}: ${esc(fundingText(c))}</span>` : ""}<a href="${esc(c.url)}" target="_blank" rel="noopener">${esc(T("official"))} ↗</a> · <a href="#c-${encodeURIComponent(c.key)}">Eligible Calls</a></div>
    <section class="oi-card"><h2>${esc(T("repA"))}</h2><div class="oi-row"><span class="score">${scoreNum(r.score)} ${esc(T("bandL." + r.band))}</span>${statusBadge(r.status)}</div>${scoreMeter(r.score)}<p class="fine">${esc(T("scoreLegend"))}</p>
      <p>${esc(T("explain." + r.status))}</p>${r.capApplied ? `<p class="fine">${esc(T("capNote"))}</p>` : ""}<p class="note">${esc(T("notice"))}</p></section>
    <section class="oi-card"><h2>${esc(T("repB"))}</h2><div class="tw"><table class="oi-t"><thead><tr><th>${esc(T("requirement"))}</th><th>${esc(T("result"))}</th><th>${esc(T("basis"))}</th></tr></thead><tbody>
      ${r.checks.map((x) => `<tr><td>${esc(codeText(x))}${x.params.quote ? `<p class="quote">${esc(x.params.quote)}</p>` : ""}${x.params.url ? `<a class="fine" href="${esc(x.params.url)}" target="_blank" rel="noopener">Programme Guide ↗</a>` : ""}</td><td><span class="res ${x.result}">${esc(x.code === "partnership.unspecified" ? T("notStated") : T("resL." + x.result))}</span></td><td class="fine">${esc(srcLabel(x.source))}</td></tr>`).join("")}
    </tbody></table></div>
    <h3>${esc(T("repB2"))}</h3><div class="dims">${Object.keys(DEFAULT_WEIGHTS).map((k) => `<div class="dim"><span>${esc(T("dims." + k))}</span><span class="fine num">${esc(T("weight"))} ${r.weights[k]}%</span>${scoreMeter(Math.round(100 * r.dims[k].s))}</div>`).join("")}</div></section>
    <section class="oi-card"><h2>${esc(T("repC"))}</h2>${r.strengths.length ? `<ul>${r.strengths.map((s) => `<li>${esc(codeText(s))}</li>`).join("")}</ul>` : `<p class="fine">${esc(T("none"))}</p>`}</section>
    <section class="oi-card"><h2>${esc(T("repD"))}</h2>${r.gaps.length ? `<ul>${r.gaps.map((x) => `<li><span class="res ${x.result}">${esc(T("resL." + x.result))}</span> ${esc(codeText(x))}</li>`).join("")}</ul>` : `<p class="fine">${esc(T("none"))}</p>`}</section>
    <section class="oi-card"><h2>${esc(T("repE"))}</h2>${r.missing.length ? `<p>${esc(listOf(r.missing, fieldName))}</p><p><a href="#org/${id}/profile">${esc(T("fillProfile"))} →</a></p>` : `<p class="fine">${esc(T("missingCall"))}</p>`}</section>
    <section class="oi-card"><h2>${esc(T("repF"))}</h2><ol>${r.next.map((x) => `<li>${esc(codeText(x))}</li>`).join("")}</ol></section>
    <section class="oi-card"><h2>${esc(T("repEval"))}</h2>${critHTML((await loadCriteria()).calls[c.id], c)}</section>
    <p class="fine">${esc(T("assessedAt", fmtTime(Date.now()), ST.org.version, EC.fmtDate(EC.META.generated)))}</p>`;
}

/* ---------- evaluation guidelines ---------- */
// Criteria per call (site/org/criteria.json, written by ingest/award_criteria.py) and Erasmus+ KA210/KA220 (erasmus-2026.json).
async function loadCriteria() {
  if (!ST.crit) { try { const r = await fetch("org/criteria.json", { cache: "no-cache" }); ST.crit = r.ok ? await r.json() : { calls: {}, frameworks: {} }; } catch { ST.crit = { calls: {}, frameworks: {} }; } }
  return ST.crit;
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
  return `<div class="crit-list">${row.criteria.map((c) => `<div class="crit"><h3><span>${esc(c.name)}</span><span class="fine num">${esc(T("scoreOf5"))}${opts.ia && c.name === "Impact" ? " · " + esc(T("iaWeight")) : ""}</span></h3>
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
    return `<p class="fine">${esc(T("critFromAnnex", fw.rows[e.row].name))} · ${ext(fw.url, T("heAnnex"))}</p>${heScoring(fw, e)}
      ${e.twoStage ? `<p class="fine">${esc(T("stage1Note"))}</p>` : ""}${heRowHTML(fw, e.row, { ia: e.ia, twoStage: e.twoStage })}${note}`;
  }
  if (e.kind === "document") {
    const t = e.table;
    return `<p class="fine">${esc(T("critFromDoc"))}${e.version ? " (" + esc(e.version) + ")" : ""} · ${ext(e.url, T("callDoc"))}${e.evalForm ? " · " + ext(e.evalForm, T("evalForm")) : ""}</p>
      ${t ? `<div class="tw"><table class="oi-t crit-t"><thead><tr><th>${esc(T("criterion"))}</th><th class="num">${esc(T("minPass"))}</th><th class="num">${esc(T("maxScore"))}</th></tr></thead><tbody>
        ${t.rows.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${esc(/^(n\/a|-)$/i.test(r.min) ? "–" : r.min)}</td><td class="num">${esc(pts(r.max))}</td></tr>`).join("")}
        <tr class="tot"><td>${esc(t.total.name)}</td><td class="num">${esc(t.total.min)}</td><td class="num">${esc(pts(t.total.max))}</td></tr></tbody></table></div>` : ""}
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
    <div class="etabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" class="etab${tab === k ? " on" : ""}" aria-selected="${tab === k}" data-etab="${k}">${esc(l)}</button>`).join("")}</div>`;
  if (tab === "horizon") {
    const fw = crit.frameworks["HE-GA-D"];
    if (!fw) return head + `<p class="note err">${esc(T("errors.data_unavailable"))}</p>`;
    const n = {}; for (const e of Object.values(crit.calls)) if (e.kind === "framework") n[e.row] = (n[e.row] || 0) + 1;
    return head + `<p class="fine">${ext(fw.url, fw.title)} · ${esc(T("retrieved", fw.retrieved))} · ${esc(T("critNotice"))}</p>
      <section class="oi-card"><h2>${esc(T("heScoringTitle"))}</h2><ul>${fw.scoring.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        <h3>${esc(T("heTwoStageTitle"))}</h3><ul>${fw.twoStage.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p class="fine">${esc(T("stage1Note"))}</p></section>
      ${Object.keys(fw.rows).map((k) => `<section class="oi-card"><h2>${esc(fw.rows[k].name)}</h2><p class="fine">${esc(T("openCallsUsing", n[k] || 0))}</p>${heRowHTML(fw, k, { twoStage: true })}</section>`).join("")}
      <p class="fine">${esc(T("heOwn"))}</p>`;
  }
  if (tab === "erasmus") {
    const g = await loadGuide();
    return head + `<p class="fine"><a href="${esc(g.guideUrl)}" target="_blank" rel="noopener">${esc(T("guide", g.guideYear, g.guideVersion))} ↗</a> · ${esc(T("guideNotice"))}</p>
    ${g.actions.map((a) => `<section class="oi-card"><h2>${esc(a.id)} · ${esc(nm(a.name))}</h2>
      <p class="fine">${esc(T("where"))} <a href="${esc(g.nationalAgenciesUrl)}" target="_blank" rel="noopener">${esc(T("na"))} ↗</a> · <a href="${esc(a.url)}" target="_blank" rel="noopener">Programme Guide ↗</a></p>
      <p>${esc(T("totalMin", a.threshold.total))}</p>
      <div class="crit-list">${a.criteria.map((c) => `<div class="crit"><h3><span>${esc(c.name)}</span><span class="fine num">${esc(T("maxPts", c.max, c.min))}</span></h3><ul>${c.points.map((p) => `<li>${esc(p)}</li>`).join("")}</ul></div>`).join("")}</div>
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
  document.querySelectorAll("[data-etab]").forEach((b) => b.addEventListener("click", () => { ST.evalTab = b.dataset.etab; EC.route(); }));
  const EF = ST.evalF;
  const p = document.getElementById("evProg"); if (p) p.addEventListener("change", () => { EF.prog = p.value; EF.shown = 20; EC.route(); });
  const a = document.getElementById("evAll"); if (a) a.addEventListener("change", () => { EF.all = a.checked; EF.shown = 20; EC.route(); });
  const m = document.getElementById("evMore"); if (m) m.addEventListener("click", () => { EF.shown += 20; const y = scrollY; EC.route(); scrollTo(0, y); });
};
/* ---------- project ideas ---------- */
const IDEA_CALLS = 6;
// Calls offered for ideas: open, not failing a mandatory check, score 50% or more, most compatible first.
const ideaCandidates = () => results().filter((r) => (r.status === "eligible" || r.status === "potential") && r.score >= 50).slice(0, 12);
const ideaReady = (p) => p.name && p.orgType && p.country && (p.description || p.objectives || p.mission);
function ideaCard(x, res) {
  const org = ST.org, it = x.idea, live = res.find((r) => r.callId === x.callId);
  const call = live ? live.call : (EC.CALLS || []).find((c) => c.id === x.callId);
  const dl = call && EC.nextDl(call);
  const score = live ? live.score : x.match.score, status = live ? live.status : x.match.status;
  const fit = x.match && x.match.conceptFit;
  const sec = (k) => { const v = it[k]; if (!v || (Array.isArray(v) && !v.length)) return ""; return `<div><h4>${esc(T("ideaF." + k))}</h4>${Array.isArray(v) ? `<ul>${v.map((y) => `<li>${esc(y)}</li>`).join("")}</ul>` : `<p>${esc(v)}</p>`}</div>`; };
  const ratings = ["alignment", "priorities", "feasibility", "impact"].filter((k) => it.fit && it.fit[k]);
  return `<article class="oi-card idea" data-idea="${esc(x.id)}">
    <div class="oi-row">${x.status === "saved" ? `<span class="sc-chip t-high">★ ${esc(T("ideaSavedChip"))}</span>` : `<span class="fine">#${x.rank}</span>`}<span class="ai-tag">AI</span><span class="fine">${esc(T("ideasAi"))}</span></div>
    <h3>${esc(it.title)}</h3>
    <p>${esc(it.concept)}</p>
    <div class="idea-call"><span class="fine">${esc(T("ideaCall"))}</span>
      ${call ? `<a href="#org/${org.id}/match/${encodeURIComponent(call.key)}">${esc(call.title)}</a>` : `<span>${esc(x.callTitle || x.callId)}</span>`}
      <div class="oi-row">${call ? `<span>${esc((EC.P[call.programme] || {}).short || call.programmeName || call.programme)}</span>` : ""}${dl ? `<span>${esc(T("deadline"))}: <b>${esc(EC.fmtDate(dl))}</b> · <span data-dl="${esc(dl)}">${esc(EC.leftText(dl))}</span></span>` : `<span class="note warn">${esc(T("ideaClosed"))}</span>`}${call && call.url ? `<a class="fine" href="${esc(call.url)}" target="_blank" rel="noopener">${esc(T("official"))} ↗</a>` : ""}</div></div>
    <div class="idea-scores">
      <div><span class="fine">${esc(T("compatRule"))}</span><div class="oi-row">${scoreNum(score)}${statusBadge(status)}</div>${scoreMeter(score)}</div>
      <div><span class="fine">${esc(T("conceptFitL"))}</span><div class="oi-row">${fit == null ? "<b>–</b>" : scoreNum(fit)}</div>${fit == null ? "" : scoreMeter(fit)}</div>
    </div>
    ${x.profileVersion !== ST.org.version ? `<p class="fine">${esc(T("ideaStale", x.profileVersion))}</p>` : ""}
    <details><summary>${esc(T("ideaF.problem"))}, ${esc(T("ideaF.objectives").toLowerCase())}, ${esc(T("ideaF.activities").toLowerCase())}…</summary>
      <div class="idea-body">${["problem", "solution", "objectives", "targetGroups", "activities", "expectedResults", "potentialPartners", "whyItFits"].map(sec).join("")}
      ${ratings.length ? `<div><h4>${esc(T("fitTitle"))}</h4><ul>${ratings.map((k) => `<li>${esc(T("fitL." + k))}: ${it.fit[k]}/5</li>`).join("")}</ul>${it.fit.reasons ? `<p class="fine">${esc(it.fit.reasons)}</p>` : ""}</div>` : ""}</div>
      <p class="fine">${esc(T("ideaGen", fmtTime(x.createdAt), x.match.score))}</p></details>
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
    const v = x.idea[k]; return Array.isArray(v) ? `<ul>${v.map((y) => `<li>${esc(y)}</li>`).join("")}</ul>` : esc(v || "–"); };
  const rows = [["title", T("ideasTitle")], ["call", T("ideaCall")], ["compat", T("compatRule")], ["fit", T("conceptFitL")], ["objectives", T("ideaF.objectives")], ["targetGroups", T("ideaF.targetGroups")], ["potentialPartners", T("ideaF.potentialPartners")], ["notes", T("ideaNotes")]];
  return `<div class="tw"><table class="oi-t cmp"><tbody>${rows.map(([k, l]) => `<tr><th scope="row">${esc(l)}</th>${pick.map((x) => `<td>${k === "title" ? `<b>${esc(x.idea.title)}</b>` : cell(x, k)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
async function secIdeas() {
  const org = ST.org, p = org.profile;
  let ideas = []; try { ideas = (await api("GET", `/orgs/${org.id}/ideas`)).ideas; } catch { /* shown empty */ }
  ST.ideas = ideas;
  ST.compare = new Set([...(ST.compare || [])].filter((id) => ideas.some((x) => x.id === id)));
  const res = results(), cands = ideaCandidates();
  // Keep the member's choice while it still matches the shortlist; otherwise start from the most compatible calls.
  const keep = ST.ideaPick && ST.ideaPickOrg === org.id ? [...ST.ideaPick].filter((id) => cands.some((r) => r.callId === id)) : [];
  ST.ideaPick = new Set(keep.length ? keep : cands.slice(0, IDEA_CALLS).map((r) => r.callId)); ST.ideaPickOrg = org.id;
  const saved = ideas.filter((x) => x.status === "saved"), sugg = ideas.filter((x) => x.status !== "saved").sort((a, b) => a.rank - b.rank);
  const ready = ideaReady(p);
  return `<h1>${esc(T("ideasTitle"))}</h1><p class="lede">${esc(T("ideasLede"))}</p>
    ${!canEdit() ? `<p class="note">${esc(T("ideasViewerNote"))}</p>` : ""}
    ${canEdit() ? `<section class="oi-card"><h2>${esc(T("ideasPick"))}</h2>
      ${!ready ? `<p class="note warn">${esc(T("ideasNeed"))} <a href="#org/${org.id}/profile">${esc(T("fillProfile"))}</a></p>` : ""}
      ${cands.length ? `<p class="fine">${esc(T("ideasPickNote", IDEA_CALLS))}</p><div class="idea-picks">${cands.map((r) => `<label class="opt"><input type="checkbox" data-pick="${esc(r.callId)}"${ST.ideaPick.has(r.callId) ? " checked" : ""}><span>${esc(r.call.title)} <span class="fine">· ${esc((EC.P[r.call.programme] || {}).short || r.call.programme)}</span></span>${scoreNum(r.score)}</label>`).join("")}</div>
        <div class="oi-row"><button type="button" class="btn" id="oiGen"${ready && ST.ideaPick.size ? "" : " disabled"}>${esc(T(ideas.length ? "ideasRegenerate" : "ideasGenerate"))}</button><span class="fine">${esc(T("ideasUse"))}</span></div><div id="oiGenMsg" role="status"></div>`
        : `<p class="note">${esc(T("ideasNoCalls"))} <a href="#org/${org.id}/matching">${esc(T("openMatching"))} →</a></p>`}</section>` : ""}
    ${ideas.length >= 2 ? `<section class="oi-card"><h2>${esc(T("compareTitle"))}</h2><div id="oiCmp">${compareHTML(ideas, res)}</div></section>` : ""}
    ${saved.length ? `<h2 class="idea-h">${esc(T("ideasSaved"))} (${saved.length})</h2><div class="match-list">${saved.map((x) => ideaCard(x, res)).join("")}</div>` : ""}
    <h2 class="idea-h">${esc(T("ideasSuggested"))}</h2>${sugg.length ? `<div class="match-list">${sugg.map((x) => ideaCard(x, res)).join("")}</div>` : `<p class="fine">${esc(T("ideasNone"))}</p>`}`;
}
afterRender.ideas = () => {
  const org = ST.org;
  document.querySelectorAll("[data-pick]").forEach((cb) => cb.addEventListener("change", () => {
    if (cb.checked && ST.ideaPick.size >= IDEA_CALLS) { cb.checked = false; return; }
    cb.checked ? ST.ideaPick.add(cb.dataset.pick) : ST.ideaPick.delete(cb.dataset.pick);
    const g = document.getElementById("oiGen"); if (g) g.disabled = !ST.ideaPick.size || !ideaReady(org.profile);
  }));
  const gen = document.getElementById("oiGen");
  if (gen) gen.addEventListener("click", async () => {
    const msg = document.getElementById("oiGenMsg");
    const cands = ideaCandidates().filter((r) => ST.ideaPick.has(r.callId)).map((r) => ({ id: r.callId, score: r.score, status: r.status, band: r.band }));
    gen.disabled = true; msg.className = "progress"; msg.textContent = T("ideasBusy");
    try {
      const r = await api("POST", `/orgs/${org.id}/ideas`, { candidates: cands, lang: L() });
      ST.ideaNote = r.generated ? T("ideasDone", r.generated, r.dropped.length) : T("ideasZero");
      EC.route();
    } catch (e) { gen.disabled = false; msg.className = "note err"; msg.textContent = errText(e); }
  });
  if (ST.ideaNote) { const m = document.getElementById("oiGenMsg"); if (m) { m.className = "note ok"; m.textContent = ST.ideaNote; } ST.ideaNote = null; }
  document.querySelectorAll("article.idea").forEach((card) => {
    const id = card.dataset.idea, x = ST.ideas.find((y) => y.id === id), msg = card.querySelector("[data-msg]");
    const on = (act, ev, fn) => { const el = card.querySelector(`[data-act="${act}"]`); if (el) el.addEventListener(ev, fn); };
    on("save", "click", async () => { try { await api("PATCH", `/orgs/${org.id}/ideas/${id}`, { status: x.status === "saved" ? "suggested" : "saved" }); EC.route(); } catch (e) { msg.textContent = errText(e); } });
    on("notes", "click", async () => { try { const v = card.querySelector("textarea").value; await api("PATCH", `/orgs/${org.id}/ideas/${id}`, { notes: v }); x.notes = v; msg.textContent = T("ideaNotesSaved"); const cmp = document.getElementById("oiCmp"); if (cmp) cmp.innerHTML = compareHTML(ST.ideas, results()); } catch (e) { msg.textContent = errText(e); } });
    on("del", "click", async () => { try { await api("DELETE", `/orgs/${org.id}/ideas/${id}`); ST.compare.delete(id); EC.route(); } catch (e) { msg.textContent = errText(e); } });
    on("compare", "change", (ev) => {
      if (ev.target.checked && ST.compare.size >= 3) { ev.target.checked = false; if (msg) msg.textContent = T("compareMax"); return; }
      ev.target.checked ? ST.compare.add(id) : ST.compare.delete(id);
      const cmp = document.getElementById("oiCmp"); if (cmp) cmp.innerHTML = compareHTML(ST.ideas, results());
    });
  });
};
const secReports = () => `<h1>${esc(T("reportsTitle"))}</h1><p class="note">${esc(T("reportsSoon"))}</p>`;

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
  const act = async (fn) => { try { await fn(); EC.route(); } catch (e) { msg.innerHTML = `<p class="note err">${esc(errText(e))}</p>`; } };
  document.querySelectorAll("[data-role]").forEach((s) => {
    const before = s.value;
    s.addEventListener("change", async () => {
      try { await api("PATCH", `/orgs/${org.id}/members/${s.dataset.role}`, { role: s.value }); EC.route(); }
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
