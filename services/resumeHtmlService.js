const fs = require("fs/promises");
const path = require("path");

const templatePath = path.join(__dirname, "..", "templates", "resumeTemplate.html");

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeHtmlWithLineBreaks(value) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function listItems(items = []) {
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderSection(title, content, className = "") {
  if (!content || !String(content).trim()) return "";
  const sectionClass = className ? ` class="${className}"` : "";
  return `<section${sectionClass}><h2>${title}</h2>${content}</section>`;
}

function renderExperience(experience = []) {
  if (!experience.length) return "";

  return experience
    .map(
      (item) => `
      <div class="entry">
        <div class="entry-head">
          <div class="entry-left">
            <p class="primary">${escapeHtml(item.role || "")}</p>
            <p class="secondary">${escapeHtml(item.company || "")}</p>
          </div>
          <div class="entry-right">
            <p class="right-primary">${escapeHtml(item.location || "")}</p>
            <p class="right-secondary">${escapeHtml(item.duration || "")}</p>
          </div>
        </div>
        ${listItems(item.points)}
      </div>
    `,
    )
    .join("");
}

function renderEducation(education = []) {
  if (!education.length) return "";

  return education
    .map(
      (item) => `
      <div class="entry">
        <div class="entry-head">
          <div class="entry-left">
            <p class="primary">${escapeHtml(item.institution || "")}</p>
            <p class="secondary">${escapeHtml(item.degree || "")}${item.score ? `, ${escapeHtml(item.score)}` : ""}</p>
          </div>
          <div class="entry-right">
            <p class="right-primary">${escapeHtml(item.duration || "")}</p>
          </div>
        </div>
      </div>
    `,
    )
    .join("");
}

function renderProjects(projects = []) {
  if (!projects.length) return "";

  return projects
    .map(
      (item) => `
      <div class="entry">
        <p class="primary">${escapeHtml(item.name || "")}</p>
        ${item.description ? `<p class="project-desc">${escapeHtmlWithLineBreaks(item.description)}</p>` : ""}
        ${
          item.technologies?.length
            ? `<p class="muted">Tech: ${escapeHtml(item.technologies.join(", "))}</p>`
            : ""
        }
      </div>
    `,
    )
    .join("");
}

function renderContact(contact = {}) {
  const parts = [contact.email, contact.phone, contact.location, contact.linkedin, contact.website]
    .filter(Boolean)
    .map((value) => escapeHtml(value));

  return parts.join(" &nbsp; | &nbsp; ");
}

function renderSkillsInline(skills = []) {
  if (!skills.length) return "";
  return `<p class="skills-line">${escapeHtml(skills.join(" | "))}</p>`;
}

function renderCertificationsInline(certifications = []) {
  if (!certifications.length) return "";
  return `<p class="certs-line">${escapeHtml(certifications.join(" | "))}</p>`;
}

async function buildResumeHtml(resumeData) {
  const template = await fs.readFile(templatePath, "utf-8");
  const summarySection = renderSection(
    "Summary",
    `<p class="summary-text">${escapeHtmlWithLineBreaks(resumeData.summary || "")}</p>`,
  );
  const skillsSection = renderSection("Skills", renderSkillsInline(resumeData.skills));
  const experienceSection = renderSection("Professional Experience", renderExperience(resumeData.experience));
  const educationSection = renderSection("Education", renderEducation(resumeData.education));
  const projectsSection = renderSection("Projects", renderProjects(resumeData.projects));
  const certificationsSection = renderSection(
    "Certifications",
    renderCertificationsInline(resumeData.certifications),
  );

  const html = template
    .replace(/{{NAME}}/g, escapeHtml(resumeData.name || "Candidate Name").toUpperCase())
    .replace(/{{TITLE}}/g, escapeHtml(resumeData.title || ""))
    .replace(/{{CONTACT}}/g, renderContact(resumeData.contact))
    .replace(/{{SUMMARY_SECTION}}/g, summarySection)
    .replace(/{{SKILLS_SECTION}}/g, skillsSection)
    .replace(/{{EXPERIENCE_SECTION}}/g, experienceSection)
    .replace(/{{EDUCATION_SECTION}}/g, educationSection)
    .replace(/{{PROJECTS_SECTION}}/g, projectsSection)
    .replace(/{{CERTIFICATIONS_SECTION}}/g, certificationsSection);

  return html;
}

module.exports = { buildResumeHtml };
