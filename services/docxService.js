const {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} = require("docx");

function bulletParagraph(text) {
  return new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "• ", bold: true }),
      new TextRun({ text: String(text || "").trim() }),
    ],
  });
}

async function generateDocxBuffer(resumeData) {
  const children = [];

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: String(resumeData.name || "").toUpperCase(),
          bold: true,
          size: 56,
        }),
      ],
    }),
  );

  if (resumeData.title) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 80 },
        children: [new TextRun({ text: String(resumeData.title), size: 22 })],
      }),
    );
  }

  const contactParts = [
    resumeData.contact?.email,
    resumeData.contact?.phone,
    resumeData.contact?.location,
    resumeData.contact?.linkedin,
    resumeData.contact?.website,
  ].filter(Boolean);

  if (contactParts.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
        children: [new TextRun({ text: contactParts.join("  |  "), size: 20 })],
      }),
    );
  }

  const addSection = (title, bodyChildren) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 160, after: 100 },
        border: {
          bottom: { color: "333333", space: 1, style: "single", size: 6 },
        },
        children: [new TextRun({ text: title.toUpperCase(), bold: true, size: 24 })],
      }),
    );
    for (const c of bodyChildren) {
      children.push(c);
    }
  };

  if (resumeData.summary) {
    const parts = String(resumeData.summary).split(/\n+/);
    const body = parts.map(
      (p) =>
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: p.trim(), size: 22 })],
        }),
    );
    addSection("Summary", body);
  }

  if (resumeData.skills?.length) {
    addSection("Skills", [
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: resumeData.skills.map((s) => String(s).trim()).join("  |  "),
            size: 22,
          }),
        ],
      }),
    ]);
  }

  if (resumeData.experience?.length) {
    const expChildren = [];
    for (const job of resumeData.experience) {
      expChildren.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({ text: String(job.role || ""), bold: true, size: 22 }),
            new TextRun({ text: "\t", size: 22 }),
            new TextRun({
              text: [job.location, job.duration].filter(Boolean).join("  •  "),
              italics: true,
              size: 20,
            }),
          ],
        }),
      );
      expChildren.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: String(job.company || ""), italics: true, size: 20 }),
          ],
        }),
      );
      for (const pt of job.points || []) {
        expChildren.push(bulletParagraph(pt));
      }
    }
    addSection("Professional Experience", expChildren);
  }

  if (resumeData.education?.length) {
    const eduChildren = [];
    for (const ed of resumeData.education) {
      eduChildren.push(
        new Paragraph({
          spacing: { before: 100, after: 40 },
          children: [
            new TextRun({ text: String(ed.institution || ""), bold: true, size: 22 }),
            new TextRun({ text: "\t", size: 22 }),
            new TextRun({ text: String(ed.duration || ""), italics: true, size: 20 }),
          ],
        }),
      );
      const line = [ed.degree, ed.score].filter(Boolean).join(" — ");
      if (line) {
        eduChildren.push(
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: line, italics: true, size: 20 })],
          }),
        );
      }
    }
    addSection("Education", eduChildren);
  }

  if (resumeData.projects?.length) {
    const projChildren = [];
    for (const pr of resumeData.projects) {
      projChildren.push(
        new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [new TextRun({ text: String(pr.name || ""), bold: true, size: 22 })],
        }),
      );
      const descParts = String(pr.description || "").split(/\n+/);
      for (const d of descParts) {
        if (d.trim()) {
          projChildren.push(
            new Paragraph({
              spacing: { after: 80 },
              children: [new TextRun({ text: d.trim(), size: 22 })],
            }),
          );
        }
      }
      if (pr.technologies?.length) {
        projChildren.push(
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({ text: "Tech: ", italics: true, size: 20 }),
              new TextRun({ text: pr.technologies.join(", "), size: 20 }),
            ],
          }),
        );
      }
    }
    addSection("Projects", projChildren);
  }

  if (resumeData.certifications?.length) {
    addSection("Certifications", [
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: resumeData.certifications.map((c) => String(c).trim()).join("  |  "),
            size: 22,
          }),
        ],
      }),
    ]);
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

module.exports = { generateDocxBuffer };
