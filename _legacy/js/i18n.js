// ============================================================
//  i18n — lightweight English/French translation layer
//  ------------------------------------------------------------
//  Loaded on every public page BEFORE js/data.js, so both the
//  JS-rendered chrome (nav/footer/modals built in data.js) and
//  the static HTML can be translated.
//
//  - Language is stored in localStorage (chpr_lang) so the choice
//    persists across pages and revisits. Default: "en".
//  - setLang() saves the choice and reloads the page; on the next
//    load every t() call and applyI18n() pick up the new language.
//    (Reloading mirrors how the rest of this prototype refreshes
//    after a state change — it's the most reliable way to retranslate
//    the JS-generated markup.)
//  - t(key, vars) returns the translated string, interpolating
//    {placeholders} from vars. Falls back to English, then the key.
//  - applyI18n(root) walks [data-i18n], [data-i18n-placeholder] and
//    [data-i18n-html] and fills them in.
// ============================================================

const CHPR_LANG_KEY = "chpr_lang";

const I18N = {
  en: {
    // ---- Nav ----
    "nav.logoSub": "Knowledge Hub",
    "nav.allResources": "All Resources",
    "nav.searchPlaceholder": "Search resources…",
    "nav.contact": "Contact us",
    "nav.signIn": "Sign in",
    "nav.postResource": "+ Post resource",
    "nav.postResourceMenu": "Post a resource",
    "nav.managementPortal": "Management portal",
    "nav.signOut": "Sign out",
    "nav.language": "Language",

    // ---- Footer ----
    "footer.org": "<strong>CHPR Resources Hub</strong> — Centre for Health Promotion and Research, Bamenda, Cameroon",
    "footer.rights": "© {year} CHPR. All rights reserved.",

    // ---- Resource type labels ----
    "type.alg": "Algorithm",
    "type.job": "Job Aid",
    "type.vid": "Video",
    "type.pos": "Poster",
    "type.expert": "Expert Pool",
    "type.trunat": "Trunat",
    "type.hiv": "HIV Pool",

    // ---- Generic ----
    "common.backToHub": "← Back to Hub",
    "common.viewAllResources": "View all resources →",
    "common.seeAll": "See all →",
    "common.filter": "Filter:",
    "common.allTypes": "All types",
    "common.all": "All",
    "common.allProjects": "All projects",
    "common.allResources": "All Resources",
    "common.resources": "Resources",
    "status.active": "Active",
    "status.completed": "Completed",
    "count.resources_one": "{n} resource",
    "count.resources_other": "{n} resources",

    // ---- Type filter buttons ----
    "filter.algorithms": "Algorithms",
    "filter.jobAids": "Job Aids",
    "filter.videos": "Videos",
    "filter.posters": "Posters",
    "filter.expert": "Expert Pool",
    "filter.trunat": "Trunat",
    "filter.hiv": "HIV Pool",

    // ---- Home (index) ----
    "home.searchPlaceholder": "Search resources, projects, or material types…",
    "home.searchBtn": "Search",
    "tile.browseAll": "Browse all",
    "tile.algorithms": "Algorithms",
    "tile.jobAids": "Job Aids",
    "tile.videos": "Videos",
    "tile.poolTests": "Pool Tests",
    "home.eyebrowActive": "Active programmes",
    "home.projects": "Projects",
    "home.eyebrowLatest": "Latest",
    "home.recentlyAdded": "Recently added resources",
    "home.allResourcesPanel": "All resources",
    "home.viewAllN": "View all {n} resources →",

    // ---- Project pages ----
    "proj.filterByType": "Filter by type:",
    "proj.setting": "Setting:",
    "proj.allSettings": "All settings",
    "proj.healthFacilities": "Health Facilities",
    "proj.healthCamps": "Health Camps",
    "proj.totalResources": "Total resources",
    "proj.resourcesSuffix": "Resources",
    "badge.chpr": "CHPR",
    "badge.respiratory": "Respiratory Health",
    "badge.tbDiagnostics": "TB Diagnostics",
    "badge.digitalDiagnostics": "Digital Diagnostics",
    "breathe.desc": "Evidence-based clinical algorithms, job aids, and specialized respiratory health resources for screening and diagnosis across health facilities and community health camps in Cameroon.",
    "prompttb.desc": "TB diagnostics, community detection algorithms, and field tools supporting active case finding and contact tracing across study sites. Formerly known as the NPOC study.",
    "rapidtb.desc": "Digital stethoscope integration, GeneXpert algorithms, and field screening tools for rapid TB identification. Focused on accelerating diagnosis in community and facility-based settings.",

    // ---- All resources ----
    "all.title": "All Resources",

    // ---- Search ----
    "search.placeholder": "Search resources, projects, material types…",
    "search.btn": "Search",
    "search.heading": "Search CHPR Resources",
    "search.prompt": "Type a term above and press Enter or click Search.",
    "search.resultsFor": "Results for",
    "search.foundSummary": "{res} found across {proj}",
    "search.projects_one": "{n} project",
    "search.projects_other": "{n} projects",
    "search.noMatch": "No resources matched",
    "search.tryDifferent": "Try a different term.",
    "search.matches_one": "{n} match",
    "search.matches_other": "{n} matches",

    // ---- Viewer ----
    "viewer.backAll": "← Back to all resources",
    "viewer.download": "Download",
    "viewer.notStarted": "Not started",
    "viewer.inProgress": "In progress",
    "viewer.completed": "Completed",
    "viewer.readingTracked": "Reading time tracked locally — pick up where you left off.",
    "viewer.notFound": "Resource not found",
    "viewer.notFoundSub": "We couldn't locate that resource. It may have been removed.",
    "viewer.browseAll": "Browse all resources",
    "viewer.comments": "Comments",
    "viewer.commentsSub": "Open to all CHPR staff. Comments are saved locally in your browser for this prototype.",
    "viewer.addComment": "Add a comment",
    "viewer.commentPlaceholder": "Write a comment about this resource…",
    "viewer.postComment": "Post comment",
    "viewer.postingAs": "Posting as",
    "viewer.noComments": "No comments yet — be the first to share your thoughts.",
    "viewer.loadingDoc": "Loading document…",
    "viewer.quizCtaTitle": "Ready to test what you've learned?",
    "viewer.quizCtaSub": "A short quiz with multiple choice and one short-answer question.",
    "viewer.quizCtaBtn": "Test your understanding",
    "viewer.contactTitle": "Have a question about this resource?",
    "viewer.contactSub": "Send us a message and the right team will reply directly to your email.",
    "viewer.contactSignin": "Sign in",
    "viewer.contactIfStaff": "if you're a CHPR staff member.",
    "viewer.contactBtn": "Contact us about this resource",

    // ---- Post modal ----
    "post.title": "Post a new resource",
    "post.sub": "Make a clinical algorithm, job aid, video, poster, or pool test available to the team.",
    "post.resourceTitle": "Resource title",
    "post.resourceTitlePh": "e.g. GeneXpert calibration checklist",
    "post.project": "Project",
    "post.type": "Resource type",
    "post.description": "Description",
    "post.descriptionPh": "What does this resource cover? When should the team reach for it?",
    "post.attachFile": "Attach file",
    "post.chooseFile": "Choose file",
    "post.noFile": "No file selected (optional)",
    "post.cancel": "Cancel",
    "post.publish": "Publish resource",

    // ---- Contact modal ----
    "contact.title": "Contact us",
    "contact.sub": "Have a question or need a hand? Choose the team you'd like to reach and we'll reply directly to your email.",
    "contact.yourName": "Your name",
    "contact.yourNamePh": "e.g. Jane Doe",
    "contact.yourEmail": "Your email",
    "contact.yourEmailPh": "you@example.com",
    "contact.replyTo": "We'll reply to this address.",
    "contact.whoReach": "Who would you like to reach?",
    "contact.whoReachPh": "Search a team (e.g. Lab, Data, Admin)…",
    "contact.routed": "Your message is routed straight to the team you pick.",
    "contact.resource": "Resource",
    "contact.message": "Your message",
    "contact.messagePh": "What would you like us to explain or send you?",
    "contact.cancel": "Cancel",
    "contact.send": "Send message",

    // ---- Quiz (static chrome) ----
    "quiz.back": "← Back to resource",
    "quiz.eyebrow": "Knowledge check",
    "quiz.title": "Test your understanding",
    "quiz.sub": "A short quiz based on the resource you just read.",
    "quiz.multipleChoice": "multiple choice",
    "quiz.shortAnswer": "short answer",
    "quiz.min": "min",
    "quiz.submit": "Submit & see score",
    "quiz.reset": "Reset answers",
    "quiz.retake": "Retake quiz",
    "quiz.backToResource": "Back to resource",
  },

  fr: {
    // ---- Nav ----
    "nav.logoSub": "Centre de connaissances",
    "nav.allResources": "Toutes les ressources",
    "nav.searchPlaceholder": "Rechercher des ressources…",
    "nav.contact": "Nous contacter",
    "nav.signIn": "Se connecter",
    "nav.postResource": "+ Publier une ressource",
    "nav.postResourceMenu": "Publier une ressource",
    "nav.managementPortal": "Portail de gestion",
    "nav.signOut": "Se déconnecter",
    "nav.language": "Langue",

    // ---- Footer ----
    "footer.org": "<strong>CHPR Resources Hub</strong> — Centre de promotion et de recherche en santé, Bamenda, Cameroun",
    "footer.rights": "© {year} CHPR. Tous droits réservés.",

    // ---- Resource type labels ----
    "type.alg": "Algorithme",
    "type.job": "Aide-mémoire",
    "type.vid": "Vidéo",
    "type.pos": "Affiche",
    "type.expert": "Pool Expert",
    "type.trunat": "Trunat",
    "type.hiv": "Pool VIH",

    // ---- Generic ----
    "common.backToHub": "← Retour au hub",
    "common.viewAllResources": "Voir toutes les ressources →",
    "common.seeAll": "Voir tout →",
    "common.filter": "Filtrer :",
    "common.allTypes": "Tous les types",
    "common.all": "Tous",
    "common.allProjects": "Tous les projets",
    "common.allResources": "Toutes les ressources",
    "common.resources": "Ressources",
    "status.active": "Actif",
    "status.completed": "Terminé",
    "count.resources_one": "{n} ressource",
    "count.resources_other": "{n} ressources",

    // ---- Type filter buttons ----
    "filter.algorithms": "Algorithmes",
    "filter.jobAids": "Aide-mémoires",
    "filter.videos": "Vidéos",
    "filter.posters": "Affiches",
    "filter.expert": "Pool Expert",
    "filter.trunat": "Trunat",
    "filter.hiv": "Pool VIH",

    // ---- Home (index) ----
    "home.searchPlaceholder": "Rechercher des ressources, projets ou types de support…",
    "home.searchBtn": "Rechercher",
    "tile.browseAll": "Tout parcourir",
    "tile.algorithms": "Algorithmes",
    "tile.jobAids": "Aide-mémoires",
    "tile.videos": "Vidéos",
    "tile.poolTests": "Tests de pool",
    "home.eyebrowActive": "Programmes actifs",
    "home.projects": "Projets",
    "home.eyebrowLatest": "Dernières",
    "home.recentlyAdded": "Ressources récemment ajoutées",
    "home.allResourcesPanel": "Toutes les ressources",
    "home.viewAllN": "Voir les {n} ressources →",

    // ---- Project pages ----
    "proj.filterByType": "Filtrer par type :",
    "proj.setting": "Contexte :",
    "proj.allSettings": "Tous les contextes",
    "proj.healthFacilities": "Établissements de santé",
    "proj.healthCamps": "Camps de santé",
    "proj.totalResources": "Ressources au total",
    "proj.resourcesSuffix": "Ressources",
    "badge.chpr": "CHPR",
    "badge.respiratory": "Santé respiratoire",
    "badge.tbDiagnostics": "Diagnostic de la TB",
    "badge.digitalDiagnostics": "Diagnostic numérique",
    "breathe.desc": "Algorithmes cliniques fondés sur des preuves, aide-mémoires et ressources spécialisées en santé respiratoire pour le dépistage et le diagnostic dans les établissements de santé et les camps de santé communautaires au Cameroun.",
    "prompttb.desc": "Diagnostic de la TB, algorithmes de détection communautaire et outils de terrain soutenant la recherche active de cas et la recherche des contacts sur les sites d'étude. Anciennement connue sous le nom d'étude NPOC.",
    "rapidtb.desc": "Intégration du stéthoscope numérique, algorithmes GeneXpert et outils de dépistage de terrain pour l'identification rapide de la TB. Axé sur l'accélération du diagnostic en milieu communautaire et en établissement.",

    // ---- All resources ----
    "all.title": "Toutes les ressources",

    // ---- Search ----
    "search.placeholder": "Rechercher des ressources, projets, types de support…",
    "search.btn": "Rechercher",
    "search.heading": "Rechercher dans les ressources CHPR",
    "search.prompt": "Saisissez un terme ci-dessus et appuyez sur Entrée ou cliquez sur Rechercher.",
    "search.resultsFor": "Résultats pour",
    "search.foundSummary": "{res} trouvée(s) dans {proj}",
    "search.projects_one": "{n} projet",
    "search.projects_other": "{n} projets",
    "search.noMatch": "Aucune ressource ne correspond à",
    "search.tryDifferent": "Essayez un autre terme.",
    "search.matches_one": "{n} correspondance",
    "search.matches_other": "{n} correspondances",

    // ---- Viewer ----
    "viewer.backAll": "← Retour à toutes les ressources",
    "viewer.download": "Télécharger",
    "viewer.notStarted": "Non commencé",
    "viewer.inProgress": "En cours",
    "viewer.completed": "Terminé",
    "viewer.readingTracked": "Temps de lecture suivi localement — reprenez là où vous vous êtes arrêté.",
    "viewer.notFound": "Ressource introuvable",
    "viewer.notFoundSub": "Nous n'avons pas pu trouver cette ressource. Elle a peut-être été supprimée.",
    "viewer.browseAll": "Parcourir toutes les ressources",
    "viewer.comments": "Commentaires",
    "viewer.commentsSub": "Ouvert à tout le personnel du CHPR. Les commentaires sont enregistrés localement dans votre navigateur pour ce prototype.",
    "viewer.addComment": "Ajouter un commentaire",
    "viewer.commentPlaceholder": "Écrivez un commentaire sur cette ressource…",
    "viewer.postComment": "Publier le commentaire",
    "viewer.postingAs": "Publié en tant que",
    "viewer.noComments": "Aucun commentaire pour l'instant — soyez le premier à donner votre avis.",
    "viewer.loadingDoc": "Chargement du document…",
    "viewer.quizCtaTitle": "Prêt à tester ce que vous avez appris ?",
    "viewer.quizCtaSub": "Un court questionnaire à choix multiples avec une question à réponse courte.",
    "viewer.quizCtaBtn": "Testez vos connaissances",
    "viewer.contactTitle": "Une question sur cette ressource ?",
    "viewer.contactSub": "Envoyez-nous un message et la bonne équipe vous répondra directement par e-mail.",
    "viewer.contactSignin": "Connectez-vous",
    "viewer.contactIfStaff": "si vous êtes un membre du personnel du CHPR.",
    "viewer.contactBtn": "Nous contacter au sujet de cette ressource",

    // ---- Post modal ----
    "post.title": "Publier une nouvelle ressource",
    "post.sub": "Mettez un algorithme clinique, un aide-mémoire, une vidéo, une affiche ou un test de pool à la disposition de l'équipe.",
    "post.resourceTitle": "Titre de la ressource",
    "post.resourceTitlePh": "ex. liste de contrôle d'étalonnage GeneXpert",
    "post.project": "Projet",
    "post.type": "Type de ressource",
    "post.description": "Description",
    "post.descriptionPh": "Que couvre cette ressource ? Quand l'équipe doit-elle l'utiliser ?",
    "post.attachFile": "Joindre un fichier",
    "post.chooseFile": "Choisir un fichier",
    "post.noFile": "Aucun fichier sélectionné (facultatif)",
    "post.cancel": "Annuler",
    "post.publish": "Publier la ressource",

    // ---- Contact modal ----
    "contact.title": "Nous contacter",
    "contact.sub": "Une question ou besoin d'aide ? Choisissez l'équipe que vous souhaitez joindre et nous vous répondrons directement par e-mail.",
    "contact.yourName": "Votre nom",
    "contact.yourNamePh": "ex. Jeanne Dupont",
    "contact.yourEmail": "Votre e-mail",
    "contact.yourEmailPh": "vous@exemple.com",
    "contact.replyTo": "Nous répondrons à cette adresse.",
    "contact.whoReach": "Qui souhaitez-vous joindre ?",
    "contact.whoReachPh": "Rechercher une équipe (ex. Labo, Données, Admin)…",
    "contact.routed": "Votre message est acheminé directement vers l'équipe choisie.",
    "contact.resource": "Ressource",
    "contact.message": "Votre message",
    "contact.messagePh": "Que souhaitez-vous que nous expliquions ou envoyions ?",
    "contact.cancel": "Annuler",
    "contact.send": "Envoyer le message",

    // ---- Quiz (static chrome) ----
    "quiz.back": "← Retour à la ressource",
    "quiz.eyebrow": "Contrôle des connaissances",
    "quiz.title": "Testez vos connaissances",
    "quiz.sub": "Un court questionnaire basé sur la ressource que vous venez de lire.",
    "quiz.multipleChoice": "à choix multiples",
    "quiz.shortAnswer": "réponse courte",
    "quiz.min": "min",
    "quiz.submit": "Soumettre et voir le score",
    "quiz.reset": "Réinitialiser les réponses",
    "quiz.retake": "Refaire le questionnaire",
    "quiz.backToResource": "Retour à la ressource",
  },
};

function getLang() {
  try {
    const l = localStorage.getItem(CHPR_LANG_KEY);
    return l === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

function setLang(lang) {
  const next = lang === "fr" ? "fr" : "en";
  try { localStorage.setItem(CHPR_LANG_KEY, next); } catch {}
  // Reload so every JS-generated string and static node is re-translated.
  window.location.reload();
}

// Translate a key. `vars` interpolates {name} placeholders.
function t(key, vars) {
  const lang = getLang();
  let str = (I18N[lang] && I18N[lang][key]);
  if (str === undefined) str = (I18N.en[key] !== undefined ? I18N.en[key] : key);
  if (vars) {
    str = str.replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m));
  }
  return str;
}

// Localized "{n} resource(s)" helper.
function tCount(n) {
  return t(n === 1 ? "count.resources_one" : "count.resources_other", { n });
}

// Walk the DOM and fill in any element tagged for translation.
//   data-i18n="key"             -> textContent
//   data-i18n-html="key"        -> innerHTML
//   data-i18n-placeholder="key" -> placeholder attribute
function applyI18n(root) {
  const scope = root || document;
  scope.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  scope.querySelectorAll("[data-i18n-html]").forEach(el => {
    el.innerHTML = t(el.getAttribute("data-i18n-html"), { year: new Date().getFullYear() });
  });
  scope.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    el.setAttribute("placeholder", t(el.getAttribute("data-i18n-placeholder")));
  });
  document.documentElement.lang = getLang();
}

// Translate static HTML automatically once the DOM is ready. JS-generated
// markup (nav/footer/etc.) is translated by the page scripts after they inject it.
document.addEventListener("DOMContentLoaded", () => applyI18n());
