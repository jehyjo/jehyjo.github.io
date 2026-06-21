(function () {
  "use strict";

  const FALLBACK_CONFIG = {
    defaultLanguage: "ko",
    languagePublication: { ko: true, en: true },
    languageLabels: { ko: "한국어", en: "English" },
    cvPdfPath: "assets/docs/CV.pdf",
  };
  const LINK_KIND_LABELS = {
    github: "GitHub",
    "project-page": "Project Page",
    paper: "Paper",
    slides: "Slides",
    poster: "Poster",
    email: "Email",
    linkedin: "LinkedIn",
  };

  const CONFIG = Object.assign({}, FALLBACK_CONFIG, window.SITE_CONFIG || {});
  let currentProfile = null;
  let currentLanguage = null;
  let lastFocusedElement = null;

  function getPublishedLanguages(publication = CONFIG.languagePublication) {
    return Object.entries(publication)
      .filter(([, isPublished]) => Boolean(isPublished))
      .map(([language]) => language);
  }

  function shouldShowLanguageSwitcher(publication = CONFIG.languagePublication) {
    return getPublishedLanguages(publication).length === 2;
  }

  function resolveInitialLanguage(options = {}) {
    const publication = options.publication || CONFIG.languagePublication;
    const defaultLanguage = options.defaultLanguage || CONFIG.defaultLanguage;
    const savedLanguage = options.savedLanguage;
    const requestedLanguage = options.requestedLanguage;
    const publishedLanguages = getPublishedLanguages(publication);

    if (requestedLanguage && publishedLanguages.includes(requestedLanguage)) return requestedLanguage;
    if (savedLanguage && publishedLanguages.includes(savedLanguage)) return savedLanguage;
    if (publishedLanguages.includes(defaultLanguage)) return defaultLanguage;
    return publishedLanguages[0] || defaultLanguage || "ko";
  }

  function getUrlParam(name) {
    try {
      return new URLSearchParams(window.location.search).get(name);
    } catch (error) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderTextWithBreaks(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function renderInlineLinks(items = []) {
    return items
      .filter((link) => Boolean(link.href))
      .map((link) => {
        const kind = link.kind || "link";
        const label = link.label || LINK_KIND_LABELS[kind] || "Link";
        const isExternal = /^https?:\/\//.test(link.href || "");
        const target = isExternal ? ' target="_blank" rel="noreferrer"' : "";
        return `<a data-link-kind="${escapeHtml(kind)}" href="${escapeHtml(link.href)}"${target}>${escapeHtml(label)}</a>`;
      })
      .join("");
  }

  function renderContactLinks(items = []) {
    return items
      .map((link) => {
        const kind = link.kind || "link";
        const label = link.label || LINK_KIND_LABELS[kind] || "Link";
        if (!link.href) {
          return `<span class="contact-link pending" data-link-kind="${escapeHtml(kind)}" aria-disabled="true">${escapeHtml(label)}</span>`;
        }

        const isExternal = /^https?:\/\//.test(link.href || "");
        const target = isExternal ? ' target="_blank" rel="noreferrer"' : "";
        return `<a class="contact-link" data-link-kind="${escapeHtml(kind)}" href="${escapeHtml(link.href)}"${target}>${escapeHtml(label)}</a>`;
      })
      .join("");
  }

  function renderTags(tags = []) {
    if (!tags.length) return "";
    return `<div class="tag-list">${tags
      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join("")}</div>`;
  }

  function renderBullets(items = []) {
    if (!items.length) return "";
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function renderHeader(section) {
    return `
      <div class="section-heading">
        ${section.eyebrow ? `<p class="eyebrow">${escapeHtml(section.eyebrow)}</p>` : ""}
        <h2>${escapeHtml(section.title || "")}</h2>
        ${section.description ? `<p>${escapeHtml(section.description)}</p>` : ""}
      </div>
    `;
  }

  function renderFactContent(fact) {
    if (fact.school || fact.major || fact.period) {
      return `
        <div class="fact-content">
          <div class="fact-main">
            ${fact.school ? `<strong class="fact-primary">${escapeHtml(fact.school)}</strong>` : ""}
            ${fact.major ? `<span class="fact-detail">${escapeHtml(fact.major)}</span>` : ""}
          </div>
          ${fact.period ? `<span class="fact-period">${escapeHtml(fact.period)}</span>` : ""}
        </div>
      `;
    }

    return `<strong class="fact-primary">${renderTextWithBreaks(fact.value)}</strong>`;
  }

  function renderDetailButton(entry) {
    if (entry.detailsReady !== true || !entry.detailBlocks?.length) return "";
    return `<button class="text-button" type="button" data-detail-id="${escapeHtml(entry.id)}">${escapeHtml(currentProfile.meta.detailLabel)}</button>`;
  }

  function renderProjectThumbnail(entry) {
    if (!entry.thumbnail?.src) {
      return `<div class="project-thumbnail is-empty" aria-hidden="true"></div>`;
    }

    return `
      <figure class="project-thumbnail">
        <img src="${escapeHtml(entry.thumbnail.src)}" alt="${escapeHtml(entry.thumbnail.alt || entry.title || "")}">
      </figure>
    `;
  }

  function renderEntryCard(entry, options = {}) {
    const links = entry.links?.length
      ? `<div class="card-links">${renderInlineLinks(entry.links)}</div>`
      : "";
    const role = entry.role ? `<p class="card-role">${escapeHtml(entry.role)}</p>` : "";
    const place = entry.place ? `<p class="card-place">${escapeHtml(entry.place)}</p>` : "";
    const period = entry.period ? `<span class="card-period">${escapeHtml(entry.period)}</span>` : "";
    const hasThumbnailSlot = options.showThumbnailSlot === true;
    const articleClass = hasThumbnailSlot ? "timeline-card has-thumbnail" : "timeline-card";
    const thumbnail = hasThumbnailSlot ? renderProjectThumbnail(entry) : "";

    return `
      <article class="${articleClass}" data-entry-id="${escapeHtml(entry.id || "")}">
        ${thumbnail}
        <div class="card-content">
          <div class="card-head">
            <div class="card-main">
              <h3>${escapeHtml(entry.title || "")}</h3>
              ${role}
              ${place}
            </div>
            ${period}
          </div>
          ${entry.summary ? `<p>${escapeHtml(entry.summary)}</p>` : ""}
          ${renderBullets(entry.bullets)}
          ${renderTags(entry.tags)}
          <div class="card-actions">
            ${renderDetailButton(entry)}
            ${links}
          </div>
        </div>
      </article>
    `;
  }

  function getSectionEntries(section = {}) {
    if (section.groups?.length) {
      return section.groups.flatMap((group) => group.entries || []);
    }

    return section.entries || [];
  }

  function renderBriefList(entries = []) {
    if (!entries.length) return "";

    return `
      <ul class="brief-list">
        ${entries
          .map(
            (entry) => `
              <li data-entry-id="${escapeHtml(entry.id || "")}">
                <span class="brief-what">${escapeHtml(entry.what || entry.title || "")}</span>
                <span class="brief-place">${escapeHtml(entry.place || "")}</span>
                <span class="brief-period">${escapeHtml(entry.period || "")}</span>
              </li>
            `
          )
          .join("")}
      </ul>
    `;
  }

  function renderTimelineGroup(group, options = {}) {
    const entries = group.entries || [];
    if (!entries.length) return "";

    const title = group.title
      ? `<h3 class="timeline-group-title">${escapeHtml(group.title)}</h3>`
      : "";
    if (group.layout === "brief-list") {
      return `
        <div class="timeline-group">
          ${title}
          ${renderBriefList(entries)}
        </div>
      `;
    }

    const listClass = group.compact ? "timeline-list compact" : "timeline-list";

    return `
      <div class="timeline-group">
        ${title}
        <div class="${listClass}">
          ${entries.map((entry) => renderEntryCard(entry, options)).join("")}
        </div>
      </div>
    `;
  }

  function renderTimeline(section, options = {}) {
    const groups = section.groups?.length
      ? section.groups
      : [{ entries: section.entries || [] }];

    if (!groups.some((group) => group.entries?.length)) return "";

    return `
      ${renderHeader(section)}
      ${groups.map((group) => renderTimelineGroup(group, options)).join("")}
    `;
  }

  function renderHome(profile) {
    const hero = profile.hero;
    const overview = profile.overview;
    const facts = overview.quickFacts
      .map(
        (fact) => `
          <div class="fact">
            <span>${escapeHtml(fact.label)}</span>
            ${renderFactContent(fact)}
          </div>
        `
      )
      .join("");
    const interests = overview.interests
      .map((interest) => `<span>${escapeHtml(interest)}</span>`)
      .join("");
    const interestBlock = interests
      ? `
        <div class="interest-block">
          <span class="interest-label">Interests</span>
          <div class="interest-strip">${interests}</div>
        </div>
      `
      : "";
    const contacts = overview.contactLinks?.length
      ? `<div class="contact-links">${renderContactLinks(overview.contactLinks)}</div>`
      : "";

    return `
      <div class="hero-layout">
        <div class="hero-copy">
          ${hero.eyebrow ? `<p class="eyebrow">${escapeHtml(hero.eyebrow)}</p>` : ""}
          <h1>${renderTextWithBreaks(hero.title)}</h1>
          <div class="hero-actions">${renderInlineLinks(hero.ctas)}</div>
        </div>
        <aside class="quiet-panel">
          <div class="fact-row compact">${facts}</div>
          ${interestBlock}
          ${contacts}
        </aside>
      </div>
    `;
  }

  function renderResearch(profile) {
    const publications = profile.publications?.entries?.length
      ? `
        <div class="subsection">
          ${renderHeader(profile.publications)}
          <div class="timeline-list compact">${profile.publications.entries.map(renderEntryCard).join("")}</div>
        </div>
      `
      : "";

    return `
      ${renderTimeline(profile.research)}
      ${publications}
    `;
  }

  function renderCertificates(profile) {
    const certificates = profile.certificates;
    const items = (certificates.items || [])
      .map(
        (item) => `
          <li>
            <div class="info-main">
              <strong>${escapeHtml(item.name)}</strong>
              <span>${escapeHtml(item.issuer)}</span>
            </div>
            <small class="info-date">${escapeHtml(item.date)}</small>
          </li>
        `
      )
      .join("");

    return `
      ${renderHeader(certificates)}
      <ul class="info-list">${items}</ul>
    `;
  }

  function renderSkills(profile) {
    const skills = profile.skills;
    const groups = (skills.groups || [])
      .map(
        (group) => `
          <div class="skill-group">
            <span>${escapeHtml(group.label)}</span>
            <p>${group.items.map(escapeHtml).join(", ")}</p>
          </div>
        `
      )
      .join("");

    return `
      ${renderHeader(skills)}
      <div class="skills-grid">${groups}</div>
    `;
  }

  function renderCv(profile) {
    const cv = profile.cv;
    return `
      <div class="cv-panel">
        <div>
          <p class="eyebrow">${escapeHtml(cv.eyebrow)}</p>
          <h2>${escapeHtml(cv.title)}</h2>
          ${cv.description ? `<p>${escapeHtml(cv.description)}</p>` : ""}
          ${renderBullets(cv.highlights)}
        </div>
        <a class="button-primary" href="${escapeHtml(CONFIG.cvPdfPath)}">${escapeHtml(cv.downloadLabel)}</a>
      </div>
    `;
  }

  function getAllEntries(profile) {
    return [
      ...(profile.research.entries || []),
      ...(profile.publications.entries || []),
      ...(profile.projects.entries || []),
      ...(profile.experience.entries || []),
      ...getSectionEntries(profile.extracurricular),
      ...(profile.awards.entries || []),
    ];
  }

  function getDetailMediaStyle(media = {}) {
    const styles = [];
    if (media.aspectRatio) styles.push(`--media-aspect-ratio: ${escapeHtml(media.aspectRatio)}`);
    if (media.displayWidth) styles.push(`--media-width: ${escapeHtml(media.displayWidth)}`);
    return styles.length ? ` style="${styles.join("; ")}"` : "";
  }

  function renderDetailMedia(detailMedia = []) {
    if (!detailMedia.length) return "";
    return `
      <div class="detail-media">
        ${detailMedia
          .map((media) => {
            const caption = media.caption ? `<figcaption>${escapeHtml(media.caption)}</figcaption>` : "";
            const mediaStyle = getDetailMediaStyle(media);
            if (media.type === "video") {
              return `
                <figure${mediaStyle}>
                  <video controls preload="metadata" ${media.poster ? `poster="${escapeHtml(media.poster)}"` : ""}>
                    <source src="${escapeHtml(media.src)}" type="${escapeHtml(media.mime || "video/mp4")}">
                  </video>
                  ${caption}
                </figure>
              `;
            }
            if (media.type === "embed") {
              return `
                <figure${mediaStyle}>
                  <iframe src="${escapeHtml(media.src)}" title="${escapeHtml(media.alt || media.caption || "Embedded media")}" loading="lazy" allowfullscreen></iframe>
                  ${caption}
                </figure>
              `;
            }
            return `
              <figure${mediaStyle}>
                <img src="${escapeHtml(media.src)}" alt="${escapeHtml(media.alt || "")}">
                ${caption}
              </figure>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function renderDetailBlock(block) {
    const blockLinks = block.links?.length
      ? `<div class="detail-links">${renderInlineLinks(block.links)}</div>`
      : "";

    return `
      <section class="detail-block">
        <h3>${escapeHtml(block.title)}</h3>
        ${block.body ? `<p>${escapeHtml(block.body)}</p>` : ""}
        ${renderBullets(block.items)}
        ${renderDetailMedia(block.media)}
        ${blockLinks}
      </section>
    `;
  }

  function renderDetailContent(entry) {
    const blocks = entry.detailBlocks
      .map((block) => renderDetailBlock(block))
      .join("");
    const links = entry.links?.length ? `<div class="detail-links">${renderInlineLinks(entry.links)}</div>` : "";

    return `
      <p class="eyebrow">${escapeHtml(entry.period || "")}</p>
      <h2 id="detailTitle">${escapeHtml(entry.title || "")}</h2>
      ${entry.role ? `<p class="card-role">${escapeHtml(entry.role)}</p>` : ""}
      ${entry.summary ? `<p class="detail-summary">${escapeHtml(entry.summary)}</p>` : ""}
      ${renderDetailMedia(entry.detailMedia)}
      ${blocks}
      ${links}
    `;
  }

  function openDetail(entryId) {
    const entry = getAllEntries(currentProfile).find((item) => item.id === entryId);
    const overlay = document.getElementById("detailOverlay");
    const content = document.getElementById("detailContent");
    if (!entry || entry.detailsReady !== true || !entry.detailBlocks?.length || !overlay || !content) return;

    lastFocusedElement = document.activeElement;
    content.innerHTML = renderDetailContent(entry);
    overlay.hidden = false;
    document.body.classList.add("has-open-detail");
    overlay.querySelector(".detail-close").focus();
  }

  function closeDetail() {
    const overlay = document.getElementById("detailOverlay");
    if (!overlay) return;
    overlay.hidden = true;
    document.body.classList.remove("has-open-detail");
    if (lastFocusedElement?.focus) lastFocusedElement.focus();
  }

  function renderNavigation(profile) {
    const nav = document.getElementById("primaryNav");
    if (!nav) return;
    nav.innerHTML = profile.navigation.primary
      .map((item) => `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`)
      .join("");
  }

  function renderLanguageControls(activeLanguage) {
    const switcher = document.getElementById("languageSwitcher");
    if (!switcher) return;

    const showSwitcher = shouldShowLanguageSwitcher(CONFIG.languagePublication);
    switcher.hidden = !showSwitcher;
    switcher.querySelectorAll("[data-language]").forEach((button) => {
      const language = button.getAttribute("data-language");
      button.textContent = language.toUpperCase();
      button.classList.toggle("is-active", language === activeLanguage);
      button.setAttribute("aria-pressed", String(language === activeLanguage));
    });
  }

  function renderPage(profile, language) {
    currentProfile = profile;
    currentLanguage = language;
    document.documentElement.lang = language;
    document.title = profile.meta.pageTitle;

    document.querySelector("[data-brand-name]").textContent = profile.meta.name;
    document.querySelector("[data-footer-text]").textContent = profile.meta.footer;

    renderNavigation(profile);
    renderLanguageControls(language);

    const renderers = {
      home: () => renderHome(profile),
      research: () => renderResearch(profile),
      projects: () => renderTimeline(profile.projects, { showThumbnailSlot: true }),
      experience: () => renderTimeline(profile.experience),
      extracurricular: () => renderTimeline(profile.extracurricular),
      awards: () => renderTimeline(profile.awards),
      certificates: () => renderCertificates(profile),
      skills: () => renderSkills(profile),
      cv: () => renderCv(profile),
    };

    document.querySelectorAll("[data-section]").forEach((section) => {
      const sectionName = section.getAttribute("data-section");
      const body = section.querySelector("[data-section-body]");
      if (!body || !renderers[sectionName]) return;
      body.innerHTML = renderers[sectionName]();
    });

    updateScrollSpy();
    const requestedDetail = getUrlParam("detail");
    if (requestedDetail) window.setTimeout(() => openDetail(requestedDetail), 0);
  }

  async function loadProfile(language) {
    const response = await fetch(`data/profile.${language}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to load profile.${language}.json`);
    return response.json();
  }

  function renderDevelopmentWarning(message) {
    const home = document.querySelector("#home [data-section-body]");
    if (!home) return;
    home.innerHTML = `
      <div class="fallback-panel">
        <p>${escapeHtml(message)}</p>
        <a href="${escapeHtml(CONFIG.cvPdfPath)}">Download CV</a>
      </div>
    `;
  }

  async function switchLanguage(language) {
    try {
      const profile = await loadProfile(language);
      renderPage(profile, language);
      if (shouldShowLanguageSwitcher(CONFIG.languagePublication)) {
        localStorage.setItem("preferredLanguage", language);
      }
    } catch (error) {
      console.error(error);
      renderDevelopmentWarning("The selected language could not be loaded.");
    }
  }

  function updateScrollSpy() {
    const navLinks = Array.from(document.querySelectorAll("#primaryNav a"));
    const visibleSections = navLinks
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    let activeId = visibleSections[0]?.id;
    for (const section of visibleSections) {
      const rect = section.getBoundingClientRect();
      if (rect.top <= 120) activeId = section.id;
    }

    navLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${activeId}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }

  async function init() {
    const publishedLanguages = getPublishedLanguages(CONFIG.languagePublication);
    if (!publishedLanguages.length) {
      renderDevelopmentWarning("No language is currently published. Enable one language in site.config.js.");
      return;
    }

    const savedLanguage = shouldShowLanguageSwitcher(CONFIG.languagePublication)
      ? localStorage.getItem("preferredLanguage")
      : null;
    const language = resolveInitialLanguage({
      publication: CONFIG.languagePublication,
      defaultLanguage: CONFIG.defaultLanguage,
      requestedLanguage: getUrlParam("lang"),
      savedLanguage,
    });

    await switchLanguage(language);

    document.addEventListener("click", (event) => {
      const languageButton = event.target.closest("[data-language]");
      if (languageButton) {
        switchLanguage(languageButton.getAttribute("data-language"));
        return;
      }

      const detailButton = event.target.closest("[data-detail-id]");
      if (detailButton) {
        openDetail(detailButton.getAttribute("data-detail-id"));
        return;
      }

      if (event.target.closest("[data-detail-close]")) closeDetail();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDetail();
    });
    document.addEventListener("scroll", updateScrollSpy, { passive: true });
  }

  window.PersonalSite = {
    getPublishedLanguages,
    shouldShowLanguageSwitcher,
    resolveInitialLanguage,
    switchLanguage,
    renderPage,
    openDetail,
    closeDetail,
  };

  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", init);
  }
})();
