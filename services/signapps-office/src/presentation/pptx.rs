//! PPTX (PowerPoint) export functionality.
//!
//! PPTX is a ZIP archive containing XML files following the Office Open XML (OOXML) specification.

use std::io::{Cursor, Write};
use zip::write::SimpleFileOptions;
use zip::ZipWriter;

use super::{Presentation, PresentationError, Slide, SlideContent, SlideLayout};

/// Convert a Presentation to PPTX bytes
pub fn generate_pptx(presentation: &Presentation) -> Result<Vec<u8>, PresentationError> {
    let buffer = Cursor::new(Vec::new());
    let mut zip = ZipWriter::new(buffer);
    let options = SimpleFileOptions::default();

    // 1. [Content_Types].xml
    zip.start_file("[Content_Types].xml", options)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
    zip.write_all(generate_content_types(presentation).as_bytes())
        .map_err(PresentationError::IoError)?;

    // 2. _rels/.rels
    zip.start_file("_rels/.rels", options)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
    zip.write_all(RELS_RELS.as_bytes())
        .map_err(PresentationError::IoError)?;

    // 3. docProps/app.xml
    zip.start_file("docProps/app.xml", options)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
    zip.write_all(generate_app_xml(presentation).as_bytes())
        .map_err(PresentationError::IoError)?;

    // 4. docProps/core.xml
    zip.start_file("docProps/core.xml", options)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
    zip.write_all(generate_core_xml(presentation).as_bytes())
        .map_err(PresentationError::IoError)?;

    // 5. ppt/presentation.xml
    zip.start_file("ppt/presentation.xml", options)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
    zip.write_all(generate_presentation_xml(presentation).as_bytes())
        .map_err(PresentationError::IoError)?;

    // 6. ppt/_rels/presentation.xml.rels
    zip.start_file("ppt/_rels/presentation.xml.rels", options)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
    zip.write_all(generate_presentation_rels(presentation.slides.len()).as_bytes())
        .map_err(PresentationError::IoError)?;

    // 7. ppt/slideMasters/slideMaster1.xml
    zip.start_file("ppt/slideMasters/slideMaster1.xml", options)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
    zip.write_all(SLIDE_MASTER.as_bytes())
        .map_err(PresentationError::IoError)?;

    // 8. ppt/slideMasters/_rels/slideMaster1.xml.rels
    zip.start_file("ppt/slideMasters/_rels/slideMaster1.xml.rels", options)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
    zip.write_all(SLIDE_MASTER_RELS.as_bytes())
        .map_err(PresentationError::IoError)?;

    // 9. Generate all 6 slide layouts
    let all_layouts = [
        SlideLayout::TitleSlide,
        SlideLayout::TitleAndContent,
        SlideLayout::TwoContent,
        SlideLayout::SectionHeader,
        SlideLayout::Blank,
        SlideLayout::TitleOnly,
    ];

    for layout in all_layouts {
        let layout_num = layout.index();
        let layout_path = format!("ppt/slideLayouts/slideLayout{}.xml", layout_num);
        zip.start_file(&layout_path, options)
            .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
        zip.write_all(generate_layout_xml(layout).as_bytes())
            .map_err(PresentationError::IoError)?;

        // Layout rels
        let rels_path = format!("ppt/slideLayouts/_rels/slideLayout{}.xml.rels", layout_num);
        zip.start_file(&rels_path, options)
            .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
        zip.write_all(SLIDE_LAYOUT_RELS.as_bytes())
            .map_err(PresentationError::IoError)?;
    }

    // 11. ppt/theme/theme1.xml
    zip.start_file("ppt/theme/theme1.xml", options)
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
    zip.write_all(THEME_XML.as_bytes())
        .map_err(PresentationError::IoError)?;

    // 12. Generate each slide
    for (i, slide) in presentation.slides.iter().enumerate() {
        let slide_num = i + 1;

        // Slide XML
        let slide_path = format!("ppt/slides/slide{}.xml", slide_num);
        zip.start_file(&slide_path, options)
            .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
        zip.write_all(generate_slide_xml(slide, slide_num).as_bytes())
            .map_err(PresentationError::IoError)?;

        // Slide rels (with notes reference if present)
        let rels_path = format!("ppt/slides/_rels/slide{}.xml.rels", slide_num);
        zip.start_file(&rels_path, options)
            .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
        zip.write_all(generate_slide_rels(slide, slide_num).as_bytes())
            .map_err(PresentationError::IoError)?;

        // Notes if present
        if slide.notes.is_some() {
            let notes_path = format!("ppt/notesSlides/notesSlide{}.xml", slide_num);
            zip.start_file(&notes_path, options)
                .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
            zip.write_all(generate_notes_xml(slide, slide_num).as_bytes())
                .map_err(PresentationError::IoError)?;

            // Notes rels
            let notes_rels_path = format!("ppt/notesSlides/_rels/notesSlide{}.xml.rels", slide_num);
            zip.start_file(&notes_rels_path, options)
                .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;
            zip.write_all(generate_notes_rels(slide_num).as_bytes())
                .map_err(PresentationError::IoError)?;
        }
    }

    let cursor = zip
        .finish()
        .map_err(|e| PresentationError::ConversionFailed(e.to_string()))?;

    Ok(cursor.into_inner())
}

// ═══════════════════════════════════════════════════════════════════════════
// STATIC XML TEMPLATES
// ═══════════════════════════════════════════════════════════════════════════

const RELS_RELS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"#;

const SLIDE_MASTER: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg>
      <p:bgRef idx="1001">
        <a:schemeClr val="bg1"/>
      </p:bgRef>
    </p:bg>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2"
            accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
    <p:sldLayoutId id="2147483650" r:id="rId2"/>
    <p:sldLayoutId id="2147483651" r:id="rId3"/>
    <p:sldLayoutId id="2147483652" r:id="rId4"/>
    <p:sldLayoutId id="2147483653" r:id="rId5"/>
    <p:sldLayoutId id="2147483654" r:id="rId6"/>
  </p:sldLayoutIdLst>
</p:sldMaster>"#;

const SLIDE_MASTER_RELS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout3.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout4.xml"/>
  <Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout5.xml"/>
  <Relationship Id="rId6" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout6.xml"/>
  <Relationship Id="rId7" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>"#;

/// Generate layout XML for a specific layout type
fn generate_layout_xml(layout: SlideLayout) -> String {
    let (layout_type, name, placeholders) = match layout {
        SlideLayout::TitleSlide => (
            "title",
            "Title Slide",
            r#"
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title 1"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="ctrTitle"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="685800" y="2130425"/><a:ext cx="7772400" cy="1470025"/></a:xfrm>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Subtitle 2"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="subTitle" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="1371600" y="3886200"/><a:ext cx="6400800" cy="1752600"/></a:xfrm>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>"#,
        ),

        SlideLayout::TitleAndContent => (
            "obj",
            "Title and Content",
            r#"
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title 1"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content 2"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="8229600" cy="4525963"/></a:xfrm>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>"#,
        ),

        SlideLayout::TwoContent => (
            "twoObj",
            "Two Content",
            r#"
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title 1"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Content Left"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph sz="half" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="1600200"/><a:ext cx="4038600" cy="4525963"/></a:xfrm>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="4" name="Content Right"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph sz="half" idx="2"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="4648200" y="1600200"/><a:ext cx="4038600" cy="4525963"/></a:xfrm>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>"#,
        ),

        SlideLayout::SectionHeader => (
            "secHead",
            "Section Header",
            r#"
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title 1"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="722313" y="4406900"/><a:ext cx="7772400" cy="1362075"/></a:xfrm>
        </p:spPr>
        <p:txBody><a:bodyPr anchor="t"/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Text 2"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="722313" y="2906713"/><a:ext cx="7772400" cy="1500187"/></a:xfrm>
        </p:spPr>
        <p:txBody><a:bodyPr anchor="b"/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>"#,
        ),

        SlideLayout::Blank => ("blank", "Blank", ""),

        SlideLayout::TitleOnly => (
            "titleOnly",
            "Title Only",
            r#"
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Title 1"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="title"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="457200" y="274638"/><a:ext cx="8229600" cy="1143000"/></a:xfrm>
        </p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>
      </p:sp>"#,
        ),
    };

    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
             xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
             xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
             type="{}" preserve="1">
  <p:cSld name="{}">
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>{}
    </p:spTree>
  </p:cSld>
</p:sldLayout>"#,
        layout_type, name, placeholders
    )
}

const SLIDE_LAYOUT_RELS: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>"#;

const THEME_XML: &str = r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="44546A"/></a:dk2>
      <a:lt2><a:srgbClr val="E7E6E6"/></a:lt2>
      <a:accent1><a:srgbClr val="4472C4"/></a:accent1>
      <a:accent2><a:srgbClr val="ED7D31"/></a:accent2>
      <a:accent3><a:srgbClr val="A5A5A5"/></a:accent3>
      <a:accent4><a:srgbClr val="FFC000"/></a:accent4>
      <a:accent5><a:srgbClr val="5B9BD5"/></a:accent5>
      <a:accent6><a:srgbClr val="70AD47"/></a:accent6>
      <a:hlink><a:srgbClr val="0563C1"/></a:hlink>
      <a:folHlink><a:srgbClr val="954F72"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office">
      <a:majorFont>
        <a:latin typeface="Calibri Light"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:majorFont>
      <a:minorFont>
        <a:latin typeface="Calibri"/>
        <a:ea typeface=""/>
        <a:cs typeface=""/>
      </a:minorFont>
    </a:fontScheme>
    <a:fmtScheme name="Office">
      <a:fillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:fillStyleLst>
      <a:lnStyleLst>
        <a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="12700"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
        <a:ln w="19050"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>
      </a:lnStyleLst>
      <a:effectStyleLst>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
        <a:effectStyle><a:effectLst/></a:effectStyle>
      </a:effectStyleLst>
      <a:bgFillStyleLst>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
        <a:solidFill><a:schemeClr val="phClr"/></a:solidFill>
      </a:bgFillStyleLst>
    </a:fmtScheme>
  </a:themeElements>
</a:theme>"#;

// ═══════════════════════════════════════════════════════════════════════════
// DYNAMIC XML GENERATORS
// ═══════════════════════════════════════════════════════════════════════════

fn generate_content_types(presentation: &Presentation) -> String {
    let mut xml = String::from(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout2.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout3.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout4.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout5.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout6.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
"#,
    );

    for (i, slide) in presentation.slides.iter().enumerate() {
        let slide_num = i + 1;
        xml.push_str(&format!(
            "  <Override PartName=\"/ppt/slides/slide{}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.slide+xml\"/>\n",
            slide_num
        ));
        // Add notes content type if present
        if slide.notes.is_some() {
            xml.push_str(&format!(
                "  <Override PartName=\"/ppt/notesSlides/notesSlide{}.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml\"/>\n",
                slide_num
            ));
        }
    }

    xml.push_str("</Types>");
    xml
}

fn generate_app_xml(presentation: &Presentation) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>SignApps Office</Application>
  <Slides>{}</Slides>
  <Company>SignApps</Company>
</Properties>"#,
        presentation.slides.len()
    )
}

fn generate_core_xml(presentation: &Presentation) -> String {
    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ");
    let author = presentation.author.as_deref().unwrap_or("SignApps");

    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
                   xmlns:dc="http://purl.org/dc/elements/1.1/"
                   xmlns:dcterms="http://purl.org/dc/terms/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{}</dc:title>
  <dc:creator>{}</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">{}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{}</dcterms:modified>
</cp:coreProperties>"#,
        escape_xml(&presentation.title),
        escape_xml(author),
        now,
        now
    )
}

fn generate_presentation_xml(presentation: &Presentation) -> String {
    let mut slide_id_list = String::new();
    for i in 0..presentation.slides.len() {
        slide_id_list.push_str(&format!(
            "    <p:sldId id=\"{}\" r:id=\"rId{}\"/>\n",
            256 + i,
            i + 2
        ));
    }

    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
                saveSubsetFonts="1">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId1"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
{}  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000" type="screen4x3"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>"#,
        slide_id_list
    )
}

fn generate_presentation_rels(slide_count: usize) -> String {
    let mut rels = String::from(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
"#,
    );

    for i in 0..slide_count {
        rels.push_str(&format!(
            "  <Relationship Id=\"rId{}\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide\" Target=\"slides/slide{}.xml\"/>\n",
            i + 2,
            i + 1
        ));
    }

    rels.push_str("</Relationships>");
    rels
}

fn generate_slide_xml(slide: &Slide, _slide_num: usize) -> String {
    let mut shapes = String::new();
    let mut shape_id = 2;

    // Add title if present
    if let Some(title) = &slide.title {
        shapes.push_str(&format!(
            r#"      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="{}" name="Title {}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="457200" y="274638"/>
            <a:ext cx="8229600" cy="1143000"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="4400" b="1"/>
              <a:t>{}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
"#,
            shape_id,
            shape_id,
            escape_xml(title)
        ));
        shape_id += 1;
    }

    // Add content shapes
    for content in &slide.contents {
        match content {
            SlideContent::Title(text) => {
                shapes.push_str(&generate_text_shape(
                    shape_id, text, 457200, 274638, 8229600, 1143000, 4400, true,
                ));
                shape_id += 1;
            },
            SlideContent::Subtitle(text) => {
                shapes.push_str(&generate_text_shape(
                    shape_id, text, 457200, 1600200, 8229600, 571500, 2400, false,
                ));
                shape_id += 1;
            },
            SlideContent::Body(elements) => {
                for element in elements {
                    for run in &element.runs {
                        shapes.push_str(&generate_text_shape(
                            shape_id,
                            &run.text,
                            457200,
                            2171700,
                            8229600,
                            3886200,
                            (run.font_size.unwrap_or(18.0) * 100.0) as i32,
                            run.bold,
                        ));
                        shape_id += 1;
                    }
                }
            },
            SlideContent::BulletList(items) => {
                let text = items.join("\n• ");
                let text = if !text.is_empty() {
                    format!("• {}", text)
                } else {
                    text
                };
                shapes.push_str(&generate_text_shape(
                    shape_id, &text, 457200, 2171700, 8229600, 3886200, 1800, false,
                ));
                shape_id += 1;
            },
            SlideContent::Shape {
                shape_type,
                width,
                height,
                x,
                y,
                fill_color,
            } => {
                shapes.push_str(&generate_shape(
                    shape_id,
                    shape_type,
                    (*x * 914400.0 / 100.0) as i64,
                    (*y * 914400.0 / 100.0) as i64,
                    (*width * 914400.0 / 100.0) as i64,
                    (*height * 914400.0 / 100.0) as i64,
                    fill_color.as_deref(),
                ));
                shape_id += 1;
            },
            SlideContent::Image { .. } => {
                // Image support would require embedding the image in the PPTX
                // For now, we skip images
            },
        }
    }

    let bg_color = slide
        .background_color
        .as_deref()
        .map(|c| {
            let c = c.trim_start_matches('#');
            format!(
                r#"    <p:bg>
      <p:bgPr>
        <a:solidFill><a:srgbClr val="{}"/></a:solidFill>
      </p:bgPr>
    </p:bg>
"#,
                c
            )
        })
        .unwrap_or_default();

    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
{}    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr>
        <a:xfrm>
          <a:off x="0" y="0"/>
          <a:ext cx="0" cy="0"/>
        </a:xfrm>
      </p:grpSpPr>
{}    </p:spTree>
  </p:cSld>
</p:sld>"#,
        bg_color, shapes
    )
}

fn generate_text_shape(
    id: u32,
    text: &str,
    x: i64,
    y: i64,
    cx: i64,
    cy: i64,
    font_size: i32,
    bold: bool,
) -> String {
    let bold_attr = if bold { " b=\"1\"" } else { "" };

    format!(
        r#"      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="{}" name="TextBox {}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="{}" y="{}"/>
            <a:ext cx="{}" cy="{}"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr wrap="square" rtlCol="0"/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US" sz="{}"{} dirty="0"/>
              <a:t>{}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
"#,
        id,
        id,
        x,
        y,
        cx,
        cy,
        font_size,
        bold_attr,
        escape_xml(text)
    )
}

fn generate_shape(
    id: u32,
    shape_type: &str,
    x: i64,
    y: i64,
    cx: i64,
    cy: i64,
    fill_color: Option<&str>,
) -> String {
    let prst = match shape_type {
        "rect" => "rect",
        "circle" => "ellipse",
        "triangle" => "triangle",
        "line" => "line",
        _ => "rect",
    };

    let fill = fill_color
        .map(|c| {
            let c = c.trim_start_matches('#');
            format!("<a:solidFill><a:srgbClr val=\"{}\"/></a:solidFill>", c)
        })
        .unwrap_or_else(|| "<a:solidFill><a:schemeClr val=\"accent1\"/></a:solidFill>".to_string());

    format!(
        r#"      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="{}" name="Shape {}"/>
          <p:cNvSpPr/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="{}" y="{}"/>
            <a:ext cx="{}" cy="{}"/>
          </a:xfrm>
          <a:prstGeom prst="{}"><a:avLst/></a:prstGeom>
          {}
        </p:spPr>
      </p:sp>
"#,
        id, id, x, y, cx, cy, prst, fill
    )
}

fn generate_notes_xml(slide: &Slide, slide_num: usize) -> String {
    let notes_text = slide.notes.as_deref().unwrap_or("");

    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
         xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
         xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Notes {}"/>
          <p:cNvSpPr txBox="1"/>
          <p:nvPr/>
        </p:nvSpPr>
        <p:spPr>
          <a:xfrm>
            <a:off x="685800" y="4400550"/>
            <a:ext cx="5486400" cy="3600450"/>
          </a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
        </p:spPr>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:r>
              <a:rPr lang="en-US"/>
              <a:t>{}</a:t>
            </a:r>
          </a:p>
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>"#,
        slide_num,
        escape_xml(notes_text)
    )
}

fn generate_slide_rels(slide: &Slide, slide_num: usize) -> String {
    let layout_num = slide.layout.index();

    let mut rels = format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout{}.xml"/>
"#,
        layout_num
    );

    // Add notes relationship if present
    if slide.notes.is_some() {
        rels.push_str(&format!(
            "  <Relationship Id=\"rId2\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide\" Target=\"../notesSlides/notesSlide{}.xml\"/>\n",
            slide_num
        ));
    }

    rels.push_str("</Relationships>");
    rels
}

fn generate_notes_rels(slide_num: usize) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide{}.xml"/>
</Relationships>"#,
        slide_num
    )
}

fn escape_xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pptx_generation() {
        let presentation = Presentation::new("Test Presentation")
            .with_author("Test Author")
            .with_slide(
                Slide::new()
                    .with_title("First Slide")
                    .with_content(SlideContent::Subtitle("Subtitle here".to_string())),
            )
            .with_slide(Slide::new().with_title("Second Slide").with_content(
                SlideContent::BulletList(vec!["Item 1".to_string(), "Item 2".to_string()]),
            ));

        let result = generate_pptx(&presentation);
        assert!(result.is_ok());

        let bytes = result.expect("generate_pptx should succeed");
        // PPTX files are ZIP archives starting with PK
        assert!(bytes.len() > 4);
        assert_eq!(&bytes[0..2], b"PK");
    }

    #[test]
    fn test_pptx_with_notes() {
        let mut slide = Slide::new().with_title("Slide with Notes");
        slide.notes = Some("These are the speaker notes".to_string());

        let presentation = Presentation::new("Notes Test").with_slide(slide);

        let result = generate_pptx(&presentation);
        assert!(result.is_ok());
    }
}
