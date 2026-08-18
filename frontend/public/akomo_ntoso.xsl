<?xml version="1.0" encoding="UTF-8"?>
<!--  akn2html-xslt1.xsl  –  minimal Akoma Ntoso ➜ HTML, XSLT 1.0  -->
<xsl:stylesheet version="1.0"
      xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
      xmlns:akn="http://docs.oasis-open.org/legaldocml/ns/akn/3.0"
      xmlns:finlex="http://data.finlex.fi/schema/finlex"
      exclude-result-prefixes="akn finlex">

  <xsl:output method="html" indent="yes" encoding="UTF-8"/>

  <!-- ========================================================
       1  ROOT  (single HTML page)
  ========================================================= -->
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <title>

        </title>
        <style>
          body{font:14px/1.5 sans-serif;margin:2em;}
          article{margin-bottom:4em;border-bottom:1px solid #999;}
          h1{font:30px/1.5 sans-serif;font-weight: bold;margin:1.5em 0 .3em 0}
          h2,h3{margin:1.5em 0 .3em 0}
          h4,h5{margin:1.2em 0 .3em 0}
          .metadata ul{margin:.3em 0 1.2em 1.5em}
        </style>
      </head>
      <body>
        <xsl:apply-templates select="/akn:akomaNtoso"/>
      </body>
    </html>
  </xsl:template>

  <!-- ========================================================
       2  DOCUMENT LEVEL
  ========================================================= -->
  <xsl:template match="akn:akomaNtoso">
    <xsl:apply-templates select="akn:act"/>
  </xsl:template>

  <xsl:template match="akn:act">
    <article>
      <!-- heading -->
      <h1>
        <xsl:value-of select="akn:preface//akn:docNumber"/>
        <xsl:text> – </xsl:text>
        <xsl:value-of select="akn:preface//akn:docTitle"/>
      </h1>

      <!-- get the ISO language code once -->
      <xsl:variable name="lang"
                    select="akn:meta/akn:identification/akn:FRBRExpression
                            /akn:FRBRlanguage/@language"/>

      <!-- choose label texts -->
      <xsl:variable name="lab-issued">
        <xsl:choose>
          <xsl:when test="$lang='fin'">Antopäivä</xsl:when>
          <xsl:when test="$lang='swe'">Meddelats</xsl:when>
          <xsl:otherwise>Issued</xsl:otherwise>
        </xsl:choose>
      </xsl:variable>

      <xsl:variable name="lab-published">
        <xsl:choose>
          <xsl:when test="$lang='fin'">Julkaisupäivä</xsl:when>
          <xsl:when test="$lang='swe'">Publiceringsdag</xsl:when>
          <xsl:otherwise>Published</xsl:otherwise>
        </xsl:choose>
      </xsl:variable>

      <!-- simple metadata -->
      <section class="metadata">
        <h3>Metadata</h3>
        <ul>
          <li><xsl:value-of select="$lab-issued"/>:
            <xsl:value-of
              select="akn:meta/akn:identification/akn:FRBRWork
                      /akn:FRBRdate[@name='dateIssued']/@date"/></li>
          <li><xsl:value-of select="$lab-published"/>:
            <xsl:value-of
              select="akn:meta/akn:identification/akn:FRBRWork
                      /akn:FRBRdate[@name='datePublished']/@date"/></li>
        </ul>
      </section>

      <!-- preamble + body -->
      <xsl:apply-templates select="akn:preamble | akn:body"/>
    </article>
  </xsl:template>

  <!-- ========================================================
       3  CONTENT  (preamble, body, chapters …)
  ========================================================= -->
  <xsl:template match="akn:preamble">
    <section class="preamble">
      <h3></h3>
      <xsl:apply-templates/>
    </section>
  </xsl:template>

  <xsl:template match="akn:body">
    <section class="body">
      <h3></h3>
      <xsl:apply-templates/>
    </section>
  </xsl:template>

  <!-- hierarchy -->
  <!-- parts (osa / avdelning) are the top-level division, above chapters -->
  <xsl:template match="akn:part">
    <div class="part">
      <h2 id="{@eId}"
          style="font-size: 1.75em; font-weight: bold; margin: 1.5em 0 .3em 0;">
        <xsl:apply-templates select="akn:num"/><br/><xsl:apply-templates select="akn:heading"/>

        <xsl:variable name="ovl"
                      select="(akn:heading/@finlex:originalVersionLabel | @finlex:originalVersionLabel)[1]"/>
        <xsl:if test="$ovl">
          <xsl:text> (</xsl:text>
          <xsl:value-of select="$ovl"/>
          <xsl:text>)</xsl:text>
        </xsl:if>
      </h2>
      <xsl:apply-templates
         select="*[not(self::akn:num or self::akn:heading)]"/>
    </div>
  </xsl:template>

  <xsl:template match="akn:chapter">
    <div class="chapter">
      <h2 id="{@eId}"><xsl:value-of select="akn:num"/><br/><xsl:value-of select="akn:heading"/>

        <xsl:variable name="ovl"
                      select="(akn:heading/@finlex:originalVersionLabel | @finlex:originalVersionLabel)[1]"/>
        <xsl:if test="$ovl">
          <xsl:text> (</xsl:text>
          <xsl:value-of select="$ovl"/>
          <xsl:text>)</xsl:text>
        </xsl:if>
      </h2>
      <xsl:apply-templates
         select="*[not(self::akn:num or self::akn:heading)]"/>
    </div>
  </xsl:template>

  <!-- cross-headings (väliotsikko) label the group of sections that follows,
       so they rank between the chapter heading and the section headings -->
  <xsl:template match="akn:crossHeading">
    <h3 class="cross-heading" id="{@eId}"
        style="font-size: 1.25em; font-weight: bold; margin: 1.5em 0 .3em 0;">
      <xsl:apply-templates/>

      <xsl:variable name="ovl" select="@finlex:originalVersionLabel"/>
      <xsl:if test="$ovl">
        <xsl:text> (</xsl:text>
        <xsl:value-of select="$ovl"/>
        <xsl:text>)</xsl:text>
      </xsl:if>
    </h3>
  </xsl:template>

<xsl:template match="akn:section">
  <div class="section">
    <h3 id="{@eId}">
      <xsl:value-of select="akn:num"/>
      <xsl:text>  </xsl:text>
      <xsl:value-of select="akn:heading"/>

      <xsl:variable name="ovl"
                    select="(akn:heading/@finlex:originalVersionLabel | @finlex:originalVersionLabel)[1]"/>
      <xsl:if test="$ovl">
        <xsl:text> (</xsl:text>
        <xsl:value-of select="$ovl"/>
        <xsl:text>)</xsl:text>
      </xsl:if>
    </h3>

    <xsl:apply-templates
       select="*[not(self::akn:num or self::akn:heading)]"/>
  </div>
</xsl:template>

  <xsl:template match="akn:subsection">
    <div class="subsection">
      <xsl:if test="akn:heading or akn:num">
        <h4 id="{@eId}">
          <xsl:value-of select="akn:num"/>
          <xsl:text>  </xsl:text>
          <xsl:value-of select="akn:heading"/>

          <xsl:variable name="ovl"
                        select="(akn:heading/@finlex:originalVersionLabel | @finlex:originalVersionLabel)[1]"/>
          <xsl:if test="$ovl">
            <xsl:text> (</xsl:text>
            <xsl:value-of select="$ovl"/>
            <xsl:text>)</xsl:text>
          </xsl:if>
        </h4>
      </xsl:if>

      <xsl:apply-templates
        select="*[not(self::akn:num or self::akn:heading)]"/>
    </div>
  </xsl:template>

  <!-- paragraphs -->
  <!-- content/intro go through apply-templates, not value-of, so that inline
       markup inside them (<i>, <ref>, …) survives instead of being flattened -->
  <xsl:template match="akn:paragraph">
    <div style="margin-top: 1em;">
      <xsl:value-of select="akn:num"/>
      <xsl:apply-templates select="*[not(self::akn:num)]"/>
    </div>
  </xsl:template>

  <xsl:template match="akn:subparagraph">
    <div style="margin-left: 1em; margin-top: 1em;">
      <xsl:value-of select="akn:num"/>
      <xsl:apply-templates select="*[not(self::akn:num)]"/>
    </div>
  </xsl:template>

  <!-- a numbered item's text stays on the same line as its num, so its p is
       rendered inline rather than as a block -->
  <xsl:template match="akn:paragraph/akn:content/akn:p
                     | akn:paragraph/akn:intro/akn:p
                     | akn:subparagraph/akn:content/akn:p
                     | akn:subparagraph/akn:intro/akn:p">
    <xsl:apply-templates/>
  </xsl:template>

  <xsl:template match="akn:p">
    <p>
      <xsl:apply-templates/>
      <xsl:if test="ancestor::akn:subsection/@finlex:originalVersionLabel and not(following-sibling::akn:p)">
        <span class="version-label">
          (<xsl:value-of select="ancestor::akn:subsection/@finlex:originalVersionLabel"/>)
        </span>
      </xsl:if>
    </p>
  </xsl:template>

  <xsl:template match="akn:content">
    <xsl:apply-templates/>
  </xsl:template>

  <!-- inline markup: without these the element is dropped by the built-in
       rule and only its text survives, losing the emphasis -->
  <xsl:template match="akn:i"><i><xsl:apply-templates/></i></xsl:template>
  <xsl:template match="akn:b"><b><xsl:apply-templates/></b></xsl:template>
  <xsl:template match="akn:u"><u><xsl:apply-templates/></u></xsl:template>
  <xsl:template match="akn:sup"><sup><xsl:apply-templates/></sup></xsl:template>
  <xsl:template match="akn:sub"><sub><xsl:apply-templates/></sub></xsl:template>

  <!-- tables: table/tr/td are dropped by the built-in rule, leaving only the
       p inside each cell, so the grid collapses into a stack of paragraphs.
       The cell classes (align-*, valign-*, width-NN) carry the layout, and
       there is no stylesheet for this markup, so translate them to inline
       styles rather than passing the class through.
       Borders are deliberately uniform: the source colsep/rowsep flags vary
       per document (729/2018 sets them, the 378/1940 tax scales do not), and
       they only ever describe internal rules, so following them would make
       tables look inconsistent from one statute to the next. -->
  <xsl:template match="akn:table">
    <table style="border-collapse: collapse; width: 100%; margin: 1em 0;">
      <xsl:apply-templates/>
    </table>
  </xsl:template>

  <xsl:template match="akn:tr">
    <tr><xsl:apply-templates/></tr>
  </xsl:template>

  <xsl:template match="akn:td | akn:th">
    <xsl:variable name="cls" select="concat(' ', @class, ' ')"/>
    <xsl:element name="{local-name()}">
      <xsl:copy-of select="@colspan | @rowspan"/>
      <xsl:attribute name="style">
        <xsl:text>border: 1px solid #999; padding: .25em .6em; text-align: </xsl:text>
        <xsl:choose>
          <xsl:when test="contains($cls, ' align-right')">right</xsl:when>
          <xsl:when test="contains($cls, ' align-center')">center</xsl:when>
          <xsl:otherwise>left</xsl:otherwise>
        </xsl:choose>
        <xsl:text>; vertical-align: </xsl:text>
        <xsl:choose>
          <xsl:when test="contains($cls, ' valign-middle')">middle</xsl:when>
          <xsl:when test="contains($cls, ' valign-bottom')">bottom</xsl:when>
          <xsl:otherwise>top</xsl:otherwise>
        </xsl:choose>
        <xsl:text>;</xsl:text>
        <xsl:if test="contains($cls, ' width-')">
          <xsl:text> width: </xsl:text>
          <xsl:value-of select="substring-before(substring-after($cls, ' width-'), ' ')"/>
          <xsl:text>%;</xsl:text>
        </xsl:if>
      </xsl:attribute>
      <xsl:apply-templates/>
    </xsl:element>
  </xsl:template>

  <!-- a cell's p carries no paragraph spacing of its own -->
  <xsl:template match="akn:td/akn:p | akn:th/akn:p">
    <p style="margin: 0;"><xsl:apply-templates/></p>
  </xsl:template>

  <xsl:template match="akn:block">
    <xsl:apply-templates/>
  </xsl:template>

  <!-- images -->
  <xsl:template match="akn:img">
    <img src="/{@src}"/>
  </xsl:template>

</xsl:stylesheet>