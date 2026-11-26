// Serbian versions of the texts Eligible Calls writes itself into the call data: eligibility reasons, call notes,
// partnership and applicant notes, programme summaries and source names (ingest/build.py and ingest/sources/*).
// The importer writes them in English; a page in Serbian shows them through ECsr.data(text).
// Official text quoted from a source (between quotation marks) stays as the source has it, in its own language.
// A text with no known form is returned unchanged.
// Classic script (no import/export): index.html loads it with <script>, org/app.js reads globalThis.ECsr.
(function (g) {
  "use strict";

  // Whole texts.
  const EXACT = {
    "Associated to Horizon Europe.": "Pridružena programu Horizont Evropa.",
    "Liechtenstein does not intend to associate to Horizon Europe.": "Lihtenštajn ne namerava da se pridruži programu Horizont Evropa.",
    "Associated to the entire programme except the EIC Fund (equity); transitional arrangements for the EIC Fund from 2026.": "Pridružena celom programu osim EIC fonda (vlasnička ulaganja); prelazni režim za EIC fond od 2026.",
    "Not listed as a participating country.": "Nije na spisku zemalja učesnica.",
    "Not listed.": "Nije na spisku.",
    "This call is run by its organiser, who sets the eligibility rules. Check the call page.": "Poziv vodi njegov organizator, koji određuje pravila o podobnosti. Proverite stranicu poziva.",
    "Third country associated to Erasmus+ (Programme Guide, Part A).": "Treća zemlja pridružena programu Erasmus+ (Vodič kroz program, deo A).",
    "Third country not associated to Erasmus+ (Region 14): some actions only, as set per action in Part B of the Programme Guide.": "Treća zemlja koja nije pridružena programu Erasmus+ (Region 14): samo neke aktivnosti, kako je za svaku određeno u delu B Vodiča kroz program.",
    "Region 14 under the 2026 Programme Guide. The UK's association to Erasmus+ was announced on 15 April 2026 for projects funded from the 2027 call: check the call document.": "Region 14 prema Vodiču kroz program za 2026. Pridruživanje Ujedinjenog Kraljevstva programu Erasmus+ najavljeno je 15. aprila 2026. za projekte finansirane iz poziva za 2027: proverite dokument poziva.",
    "Third country not associated to Erasmus+ (Region 1, Western Balkans): can take part only in some actions, as set per action in Part B of the Programme Guide; usually as a partner, not as the applicant.": "Treća zemlja koja nije pridružena programu Erasmus+ (Region 1, Zapadni Balkan): može da učestvuje samo u nekim aktivnostima, kako je za svaku određeno u delu B Vodiča kroz program; obično kao partner, ne kao podnosilac prijave.",
    "Third country not associated to Erasmus+ (Region 2, Neighbourhood East): can take part only in some actions, as set per action in Part B of the Programme Guide.": "Treća zemlja koja nije pridružena programu Erasmus+ (Region 2, Istočno susedstvo): može da učestvuje samo u nekim aktivnostima, kako je za svaku određeno u delu B Vodiča kroz program.",
    "Third country not associated to Erasmus+ (Region 2): some actions only, as set per action in Part B of the Programme Guide. Georgian authorities are not eligible under any action.": "Treća zemlja koja nije pridružena programu Erasmus+ (Region 2): samo neke aktivnosti, kako je za svaku određeno u delu B Vodiča kroz program. Organi vlasti Gruzije nisu podobni ni za jednu aktivnost.",
    "Not in the programme area listed on interreg.eu. A programme can accept a partner from outside its area only in specific cases set in the call.": "Nije u programskoj oblasti navedenoj na interreg.eu. Program može da prihvati partnera izvan svoje oblasti samo u posebnim slučajevima koje poziv određuje.",
    "Part of the programme area: only organisations located in the eligible regions of this country can apply (interreg.eu lists the regions). Check the call page.": "Deo programske oblasti: mogu da konkurišu samo organizacije iz podobnih regiona ove zemlje (regione navodi interreg.eu). Proverite stranicu poziva.",
    "Full participation.": "Puno učešće.",
    "Full participation (EEA).": "Puno učešće (EEP).",
    "Takes part in the Culture strand only; this is a MEDIA call.": "Učestvuje samo u potprogramu Kultura; ovo je poziv potprograma MEDIA.",
    "Takes part in specified MEDIA actions only: check whether this action is one of them.": "Učestvuje samo u navedenim aktivnostima potprograma MEDIA: proverite da li je ova aktivnost jedna od njih.",
    "SO3 Cybersecurity is not covered by this country's Digital Europe agreement.": "Sporazum ove zemlje o programu Digitalna Evropa ne obuhvata specifični cilj 3, sajber-bezbednost.",
    "Participates in the EDF.": "Učestvuje u Evropskom fondu za odbranu.",
    "Full programme participant. Some Digital Europe calls restrict participation for security reasons: check section 6 of the call document.": "Puni učesnik programa. Neki pozivi programa Digitalna Evropa ograničavaju učešće iz bezbednosnih razloga: proverite odeljak 6 dokumenta poziva.",
    "Culture strand and Creative Europe Desks only.": "Samo potprogram Kultura i deskovi Kreativne Evrope.",
    "Culture strand and Creative Europe Desks only (from 01.01.2026).": "Samo potprogram Kultura i deskovi Kreativne Evrope (od 1. 1. 2026).",
    "Culture and Cross-sectoral strands plus specified MEDIA actions.": "Potprogrami Kultura i Međusektorski, uz navedene aktivnosti potprograma MEDIA.",
    "Participates in all CERV strands except Union Values; this call is not in that strand.": "Učestvuje u svim potprogramima programa CERV osim Vrednosti Unije; ovaj poziv nije u tom potprogramu.",
    "Denmark does not take part in the Justice Programme.": "Danska ne učestvuje u programu Pravda.",
    "Participates in the Justice Programme.": "Učestvuje u programu Pravda.",
    "Has confirmed interest but has no participation agreement yet.": "Potvrdila je interesovanje, ali još nema sporazum o učešću.",
    "The Union Values strand is not covered by this country's CERV agreement.": "Sporazum ove zemlje o programu CERV ne obuhvata potprogram Vrednosti Unije.",
    "Participates in listed strands only (not the Food strand).": "Učestvuje samo u navedenim potprogramima (ne u potprogramu Hrana).",
    "Participates only in Specific Objectives 1, 2, 4 and 5.": "Učestvuje samo u specifičnim ciljevima 1, 2, 4 i 5.",
    "All strands except the Union Values strand.": "Svi potprogrami osim potprograma Vrednosti Unije.",
    "All sub-programmes.": "Svi potprogrami.",
    "Associated to Euratom from 2025.": "Pridružena programu Euratom od 2025.",
    "Associated to Euratom.": "Pridružena programu Euratom.",
    "Participation is limited to legal entities established in Member States, associated countries to Horizon Europe and EuroHPC JU Participating States.": "Učešće je ograničeno na pravna lica osnovana u državama članicama, zemljama pridruženim programu Horizont Evropa i državama učesnicama zajedničkog preduzeća EuroHPC.",
    "Participation is limited to legal entities established in Member States and in countries associated to the Euratom Research and Training Programme (Ukraine and Switzerland).": "Učešće je ograničeno na pravna lica osnovana u državama članicama i u zemljama pridruženim programu Euratom za istraživanje i obuku (Ukrajina i Švajcarska).",
    // call notes
    "Entities established in an eligible country but controlled by China or by a legal entity established in China are not eligible (restriction on control in critical technology areas, General Annex B).": "Nisu podobna pravna lica osnovana u podobnoj zemlji koja kontroliše Kina ili pravno lice osnovano u Kini (ograničenje kontrole u oblastima kritičnih tehnologija, Opšti aneks B).",
    "This is a call run by an EU-funded project (financial support to third parties), not by the Commission. The organiser sets the rules.": "Ovaj poziv vodi projekat finansiran iz EU (finansijska podrška trećim licima), a ne Evropska komisija. Pravila određuje organizator.",
    "Subject to restrictions for the protection of European communication networks.": "Podleže ograničenjima radi zaštite evropskih komunikacionih mreža.",
    "Defence calls also apply rules on control by non-associated third countries. Check the call document.": "Pozivi u oblasti odbrane primenjuju i pravila o kontroli od strane nepridruženih trećih zemalja. Proverite dokument poziva.",
    "EDIP / Ukraine Support Instrument call: the call document sets its own eligibility rules, including for Ukrainian entities.": "Poziv programa EDIP / Instrumenta za podršku Ukrajini: dokument poziva određuje sopstvena pravila o podobnosti, uključujući pravna lica iz Ukrajine.",
    "Coordinators must be legal entities established in Widening countries as defined in the Horizon Europe Regulation.": "Koordinatori moraju biti pravna lica osnovana u zemljama „Widening“ prema Uredbi o programu Horizont Evropa.",
    // partnership and applicant notes
    "Any eligible legal entity, unless the call conditions say otherwise.": "Svako podobno pravno lice, osim ako uslovi poziva ne određuju drugačije.",
    "Derived from keywords in the call text.": "Izvedeno iz ključnih reči u tekstu poziva.",
    "From the source's target groups; check the call page.": "Prema ciljnim grupama koje navodi izvor; proverite stranicu poziva.",
    "The call closes on the deadline or earlier, when the available funds are used up (call text).": "Poziv se zatvara na dan roka ili ranije, kada se raspoloživa sredstva potroše (tekst poziva).",
    "Prize: see rules of contest.": "Nagrada: pogledajte pravila konkursa.",
    "ERC grants: a Principal Investigator applies with a host institution.": "ERC grantovi: glavni istraživač konkuriše zajedno sa ustanovom domaćinom.",
    // programme notes
    "No EEA country has expressed interest in CEF. The call document can still allow third-country entities in specific cases (section on eligible countries).": "Nijedna zemlja EEP nije iskazala interesovanje za CEF. Dokument poziva ipak može da dozvoli učešće pravnih lica iz trećih zemalja u posebnim slučajevima (odeljak o podobnim zemljama).",
  };

  // Source names (META.sources[].name) and the names used inside notes.
  const SOURCE = {
    "EU Funding & Tenders Portal (grant topics)": "Portal EU Funding & Tenders (teme grantova)",
    "EU Funding & Tenders Portal: calls by EU-funded projects (organiser page checked)": "Portal EU Funding & Tenders: pozivi projekata finansiranih iz EU (stranica organizatora proverena)",
    "interreg.eu calls for projects (Interact / keep.eu), linked to each programme's call page": "Pozivi za projekte na interreg.eu (Interact / keep.eu), sa vezom ka stranici poziva svakog programa",
    "EEA and Norway Grants open calls (eeagrants.org, Financial Mechanism Office)": "Otvoreni pozivi EEP i Norveških grantova (eeagrants.org, Kancelarija finansijskog mehanizma)",
    "ERA-LEARN call calendar (European partnerships' joint calls)": "Kalendar poziva ERA-LEARN (zajednički pozivi evropskih partnerstava)",
    "UKRI Funding Finder (ukri.org)": "UKRI Funding Finder (ukri.org)",
    "EIT opportunities (eit.europa.eu, European Institute of Innovation and Technology)": "Prilike EIT (eit.europa.eu, Evropski institut za inovacije i tehnologiju)",
    "ESA Business Applications funding (business.esa.int)": "Finansiranje ESA Business Applications (business.esa.int)",
    "Erasmus+ Programme Guide (actions managed by the national agencies)": "Vodič kroz program Erasmus+ (aktivnosti kojima upravljaju nacionalne agencije)",
    "Innovation Fund of the Republic of Serbia (Fond za inovacionu delatnost)": "Fond za inovacionu delatnost Republike Srbije",
    "Ministry of Tourism and Youth of the Republic of Serbia (Ministarstvo turizma i omladine)": "Ministarstvo turizma i omladine Republike Srbije",
    "Ministry for Human and Minority Rights and Social Dialogue of the Republic of Serbia": "Ministarstvo za ljudska i manjinska prava i društveni dijalog Republike Srbije",
    "Development Agency of Serbia (Razvojna agencija Srbije)": "Razvojna agencija Srbije",
    "Science Fund of the Republic of Serbia (Fond za nauku)": "Fond za nauku Republike Srbije",
  };
  const source = (s) => SOURCE[s] || s;

  // Programmes: Serbian name where one is in official use in Serbia, summary and note.
  const PROG = {
    HORIZON: { name: "Horizont Evropa", short: "Horizont Evropa", summary: "Okvirni program EU za istraživanje i inovacije." },
    EURATOM: { name: "Program Euratom za istraživanje i obuku", summary: "Program EU za istraživanje i obuku u oblasti nuklearnih istraživanja." },
    DIGITAL: { name: "Program Digitalna Evropa", short: "Digitalna Evropa", summary: "Razvoj digitalnih kapaciteta: računarstvo visokih performansi (SO1), veštačka inteligencija (SO2), sajber-bezbednost (SO3), napredne digitalne veštine (SO4), uvođenje i najbolja upotreba (SO5)." },
    CREA: { name: "Kreativna Evropa", short: "Kreativna Evropa", summary: "Program EU za kulturni, kreativni i audiovizuelni sektor: potprogrami Kultura, MEDIA i Međusektorski." },
    CERV: { name: "Građani, jednakost, prava i vrednosti (CERV)", summary: "Finansira civilno društvo i javna tela koja se bave jednakošću, pravima, rodno zasnovanim nasiljem (Daphne), učešćem građana i vrednostima Unije." },
    SMP: { name: "Program jedinstvenog tržišta", short: "Jedinstveno tržište", summary: "Unutrašnje tržište, konkurentnost malih i srednjih preduzeća, potrošači, standardizacija, statistika i lanac ishrane." },
    CEF: { name: "Instrument za povezivanje Evrope (CEF)", short: "CEF", summary: "Transevropske mreže u saobraćaju, energetici i digitalnoj infrastrukturi." },
    EDF: { name: "Evropski fond za odbranu / EDIP", summary: "Istraživanje i razvoj kapaciteta u oblasti odbrane; obuhvata i pozive programa EDIP i Instrumenta za podršku Ukrajini (USI)." },
    I3: { name: "Međuregionalna ulaganja u inovacije (I3)", summary: "Međuregionalna ulaganja u inovacije u okviru ERDF." },
    ERASMUS: { summary: "Program EU za obrazovanje, obuku, mlade i sport. Pozivi na portalu Funding & Tenders su centralizovane aktivnosti (EACEA); većinom aktivnosti mobilnosti i partnerstava upravljaju nacionalne agencije." },
    JUST: { name: "Program Pravda", short: "Pravda", summary: "Pravosudna saradnja, obuka pravosudnih profesionalaca i pristup pravdi." },
    ESF: { name: "Evropski socijalni fond plus (ESF+ / EaSI)" },
    JTM: { name: "Mehanizam za pravednu tranziciju", short: "Pravedna tranzicija" },
    ISF: { name: "Fond za unutrašnju bezbednost", short: "Unutrašnja bezbednost" },
    SOCPL: { name: "Linije socijalnih prerogativa i posebnih nadležnosti" },
    PPPA: { name: "Pilot-projekti i pripremne aktivnosti" },
    EUBA: { name: "Tela i agencije EU" },
    INTERREG: { name: "Interreg (Evropska teritorijalna saradnja)" },
    PARTNERSHIPS: { name: "Evropska partnerstva: zajednički transnacionalni pozivi", short: "Evropska partnerstva" },
    UKRI: { name: "Istraživanje i inovacije Ujedinjenog Kraljevstva (UKRI)" },
    EIT: { name: "Evropski institut za inovacije i tehnologiju (EIT)" },
    ESA: { name: "Evropska svemirska agencija: Business Applications and Space Solutions" },
    "RS-IFOND": { name: "Fond za inovacionu delatnost Republike Srbije", short: "Fond za inovacionu delatnost" },
    "RS-RAS": { name: "Razvojna agencija Srbije", short: "Razvojna agencija Srbije" },
  };
  function prog(p) {
    const x = PROG[p.id] || {};
    return { ...p, name: x.name || p.name, short: x.short || x.name || p.short, summary: x.summary || (p.summary ? data(p.summary) : p.summary), note: p.note ? data(p.note) : p.note };
  }

  const q = (s) => "„" + s + "“";
  // Patterns: [regular expression, replacement]. Quotes from the source are kept as the source has them.
  const RE = [
    [/^UKRI funds UK organisations; organisations elsewhere can usually join only as project partners funding their own involvement\. The source says: "(.*)"$/s,
      (m, a) => `UKRI finansira organizacije iz Ujedinjenog Kraljevstva; organizacije iz drugih zemalja obično mogu da učestvuju samo kao partneri koji sami finansiraju svoje učešće. Izvor navodi: ${q(a)}`],
    [/^UK organisations that meet UKRI's eligibility rules can apply\. The source says: "(.*)"$/s,
      (m, a) => `Mogu da konkurišu organizacije iz Ujedinjenog Kraljevstva koje ispunjavaju pravila UKRI o podobnosti. Izvor navodi: ${q(a)}`],
    [/^Under the UKRI and Research Council of Norway Money Follows Cooperation agreement, a project co-lead can be based in a Norwegian institution\. The source says: "(.*)"$/s,
      (m, a) => `Prema sporazumu UKRI i Istraživačkog saveta Norveške „Money Follows Cooperation“, korukovodilac projekta može biti iz norveške ustanove. Izvor navodi: ${q(a)}`],
    [/^The call text contains a participation restriction that has not been reviewed yet: "(.*)" Check the call document\.$/s,
      (m, a) => `Tekst poziva sadrži ograničenje učešća koje još nije pregledano: ${q(a)} Proverite dokument poziva.`],
    [/^The eligible countries are not stated in the Portal data for this call\.(.*)$/s, (m, rest) => "Podobne zemlje nisu navedene u podacima portala za ovaj poziv." + (rest.trim() ? " " + data(rest.trim()) : "")],
    [/^The Portal data says: "(.*?)"\s*(.*)$/s, (m, a, rest) => `Podaci portala navode: ${q(a)}` + (rest ? " " + data(rest) : "")],
    [/^This programme has no published list of participating countries\. Check the eligible countries in the call document\.$/, () => "Za ovaj program nije objavljen spisak zemalja učesnica. Podobne zemlje proverite u dokumentu poziva."],
    [/^Joint Undertaking calls set their own eligibility rules\. Check the eligible countries in the call document\.$/, () => "Pozivi zajedničkih preduzeća određuju sopstvena pravila o podobnosti. Podobne zemlje proverite u dokumentu poziva."],
    [/^The eligible countries are not stated in structured form by (.+?)\. Check the call page\.$/s, (m, s) => `Izvor „${source(s)}“ ne navodi podobne zemlje u strukturisanom obliku. Proverite stranicu poziva.`],
    [/^Not listed as eligible by (.+?)\. The source says: "(.*)"$/s, (m, s, a) => `Izvor „${source(s)}“ ne navodi ovu zemlju kao podobnu. Izvor navodi: ${q(a)}`],
    [/^Listed as eligible by (.+?)\. The source says: "(.*)"$/s, (m, s, a) => `Izvor „${source(s)}“ navodi ovu zemlju kao podobnu. Izvor navodi: ${q(a)}`],
    [/^Not listed by (.+?); check the call page\.$/s, (m, s) => `Izvor „${source(s)}“ ne navodi ovu zemlju; proverite stranicu poziva.`],
    [/^Listed as eligible by (.+?)\.$/s, (m, s) => `Izvor „${source(s)}“ navodi ovu zemlju kao podobnu.`],
    [/^A funding organisation from this country takes part in the call\. Applicants are funded by their national funder under its own rules \(national annex of the call\)\. The source says: "(.*)"$/s,
      (m, a) => `U pozivu učestvuje organizacija za finansiranje iz ove zemlje. Podnosioce finansira njihov nacionalni finansijer po svojim pravilima (nacionalni aneks poziva). Izvor navodi: ${q(a)}`],
    [/^No funding organisation from this country takes part in the call, so applicants from here cannot receive funding from it\. They can join a consortium only as a cooperation partner that pays its own costs\.(?: The source says: "(.*)")?$/s,
      (m, a) => "U pozivu ne učestvuje nijedna organizacija za finansiranje iz ove zemlje, pa podnosioci odavde ne mogu da dobiju sredstva iz njega. U konzorcijum mogu da uđu samo kao partneri u saradnji koji sami snose svoje troškove." + (a ? ` Izvor navodi: ${q(a)}` : "")],
    [/^The call document \((.+?)\) lists the eligible countries: (.+?)\. This country is not on the list\.$/s,
      (m, d, list) => `Dokument poziva (${d.replace(/^Call document/, "Dokument poziva")}) navodi podobne zemlje: ${list.replace(/EU Member States/g, "države članice EU").replace(/Iceland/g, "Island").replace(/Liechtenstein/g, "Lihtenštajn").replace(/Norway/g, "Norveška")}. Ova zemlja nije na spisku.`],
    [/^Run by (.+?)\. The organiser sets the rules; Eligible Calls reads this call from (.+?)\.$/s,
      (m, org, s) => `Poziv vodi ${org.replace(/\s+,/g, ",")}. Pravila određuje organizator; Eligible Calls ovaj poziv preuzima iz izvora „${source(s)}“.`],
    [/^Calls from (.+?)\. Eligible countries are taken from the source where it states them; otherwise check each call\.$/s,
      (m, s) => `Pozivi iz izvora „${source(s)}“. Podobne zemlje se preuzimaju iz izvora kada ih navodi; u suprotnom proverite svaki poziv.`],
    [/^No list of participating countries was available on the Funding & Tenders Portal on (.+?)\. Eligible countries are set in each call document\.$/s,
      (m, d) => `Spisak zemalja učesnica nije bio dostupan na portalu Funding & Tenders na dan ${d}. Podobne zemlje određuje dokument svakog poziva.`],
    [/^Two-stage call: pre-proposal deadline (\S+?)\s*full-proposal deadline (\S+?)\s*\(only for invited pre-proposals\)\.$/s,
      (m, a, b) => `Poziv u dve faze: rok za preliminarni predlog ${a}, rok za pun predlog ${b} (samo za pozvane preliminarne predloge).`],
    [/^Subject to (?:the restrictions of )?Article (\d+\(\d+\)) of the Digital Europe Regulation(?: for security reasons)?(?:,| \()(?: as specified in)?\s*(?:see )?Appendix ?(\d+)\s*of the Work Programme\)?\.$/s,
      (m, art, app) => `Podleže ograničenjima člana ${art} Uredbe o programu Digitalna Evropa iz bezbednosnih razloga (videti Dodatak ${app} programa rada).`],
    [/^Standard Horizon Europe rule for this type of action: at least three independent legal entities from three different eligible countries, one of them in an EU Member State \(General Annexes, Annex B\), unless the topic says otherwise\.?$/s,
      () => "Standardno pravilo programa Horizont Evropa za ovu vrstu aktivnosti: najmanje tri nezavisna pravna lica iz tri različite podobne zemlje, od kojih je jedno iz države članice EU (Opšti aneksi, aneks B), osim ako tema ne određuje drugačije."],
  ];

  const cache = new Map();
  function data(text) {
    if (typeof text !== "string" || !text) return text;
    if (cache.has(text)) return cache.get(text);
    const t = text.trim();
    let out = EXACT[t] || SOURCE[t] || null;
    if (!out) for (const [re, f] of RE) { if (re.test(t)) { out = t.replace(re, f); break; } }
    out = out || text;
    if (cache.size < 5000) cache.set(text, out);
    return out;
  }
  // Notes written into criteria and form data ("described in section 9 of the Call document ...").
  function critNote(text) {
    if (typeof text !== "string" || !text) return text;
    return text
      .replace(/^(?:Award criteria, scoring and thresholds |Evaluation criteria, scoring, threshold and process |The award criteria )?(?:are |is )?(?:as )?described in (?:General )?Annex D (?:of the Work Programme General Annexes|\(Award criteria\) of the (?:Euratom )?Work Programme[^.]*)\.?$/i, "Opisani su u aneksu D Opštih aneksa programa rada.")
      .replace(/^(?:Evaluation criteria, scoring, threshold and process |Award criteria, scoring and thresholds )?(?:are |is )?described in section (\d+) of the call document\s*(.*?)\s*\.?$/i, (m, n, rest) => `Opisani su u odeljku ${n} dokumenta poziva${rest ? " " + rest : ""}.`)
      .replace(/^(?:Evaluation criteria, scoring, threshold and process |Award criteria, scoring and thresholds )?(?:are |is )?described in the call document\s*\.?$/i, "Opisani su u dokumentu poziva.");
  }

  // Score lines read from a call document's award criteria section (ingest/award_criteria.py, SUMMARY).
  function critSum(text) {
    if (typeof text !== "string") return text;
    const pts = (s) => s.replace(/ and /g, " i ").replace(/\s*points?\.?$/i, "").trim();
    let m;
    if ((m = text.match(/^Maximum points:\s*(.+?)\.?$/i))) return `Najveći broj bodova: ${pts(m[1])}.`;
    if ((m = text.match(/^Overall threshold:\s*(.+?)\.?$/i))) return `Ukupni prag: ${pts(m[1])} bodova.`;
    if ((m = text.match(/^Individual thresholds? per criterion:\s*(.+?)\.?$/i))) return /^(n\/a|not applicable)$/i.test(m[1].trim()) ? "Pojedinačni pragovi po kriterijumu: ne primenjuju se." : `Pojedinačni pragovi po kriterijumu: ${pts(m[1])} bodova.`;
    return text;
  }

  // Whether a text from a source needs a machine translation for a page in `lang`. Same rules as detectLang in
  // site/org/lang.js (kept here because this file is a classic script the page loads before the modules).
  const SRW = new Set("i u na za sa se je su da od do iz kao koji koja koje kojih ili kroz kod prema nije smo ste bi biti ovo ova ovaj njihov naš naša naše nas svoje svojih takođe takodje kako".split(" "));
  const ENW = new Set("the and of to in for with is are on by from that this our we their as an be at which who".split(" "));
  function langOf(text) {
    const t = String(text || ""), letters = (t.match(/\p{L}/gu) || []).length;
    if (!letters) return "unknown";
    if ((t.match(/[Ѐ-ӿ]/g) || []).length / letters > 0.3) return "sr";
    const dia = (t.match(/[čćšžđČĆŠŽĐ]/g) || []).length;
    const words = t.toLowerCase().split(/[^\p{L}]+/u).filter(Boolean);
    let sr = 0, en = 0;
    for (const w of words) { if (SRW.has(w)) sr++; if (ENW.has(w)) en++; }
    if (en >= 3 && en > 2 * sr) return "en";
    if (dia >= 2 || (dia >= 1 && sr >= 1) || (sr >= 2 && sr > en)) return "sr";
    if (en >= 2 || (en >= 1 && words.length <= 8)) return "en";
    const morph = words.filter((w) => (/(tion|tions|ment|ments|ing|ity|ities|ance|ence|ship|ness|ive|able|ical|ology|ials|ies|ics)$/.test(w) || /^(call|calls|open|grant|grants|fund|award|prize|digital|network|programme|support|research|sandpit|data|energy|health)$/.test(w))).length;
    if (words.length >= 6 && morph >= Math.max(2, words.length / 4) && !dia) return "en";
    if (words.length >= 6) return "other";
    return "unknown";
  }
  function needsTr(text, lang) {
    const words = String(text || "").split(/[^\p{L}]+/u).filter((w) => w.length >= 3);
    if (words.length < 2) return false;   // codes, acronyms, single names
    const l = langOf(text);
    return lang === "sr" ? l !== "sr" : l === "sr" || l === "other";
  }

  g.ECsr = { data, source, prog, critNote, critSum, langOf, needsTr };
})(typeof globalThis !== "undefined" ? globalThis : window);
