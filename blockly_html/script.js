const LOCAL_STORAGE_KEY = "blockly-html-autosave-v1";
const PROJECT_VERSION = 1;
const PROJECT_FORMAT = "blockly-html";
const PREVIEW_WIDTH_STORAGE_KEY = "blockly-html-preview-width-v1";
const DEFAULT_PREVIEW_WIDTH = 420;
const MIN_PREVIEW_WIDTH = 320;
const MAX_PREVIEW_WIDTH = 720;
const MIN_WORKSPACE_WIDTH = 420;
const PREVIEW_RESIZE_STEP = 24;

const EMPTY_CODE_MESSAGE = [
  "<!-- Start by adding an HTML document block. -->",
  "<!-- Then build your page using headings, graphics, media, lists, tables, forms, and CSS styles. -->"
].join("\n");

const EMPTY_RENDER_DOCUMENT = [
  "<!DOCTYPE html>",
  "<html lang=\"en\">",
  "<head>",
  "  <meta charset=\"UTF-8\">",
  "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
  "  <title>Blockly HTML Builder</title>",
  "</head>",
  "<body style=\"font-family: Arial, sans-serif; padding: 24px; color: #152033;\">",
  "  <h1>Start building</h1>",
  "  <p>Add one HTML document block, then place content in the body and styles in the head.</p>",
  "</body>",
  "</html>"
].join("\n");

const CATEGORY_COLOURS = {
  document: "#2d5ecf",
  text: "#2c7a63",
  structure: "#5f56b3",
  media: "#c06a1c",
  lists: "#8a3f59",
  tables: "#3f6f96",
  forms: "#7c5a20",
  css: "#2e6d73"
};

const GLOBAL_ATTRIBUTE_HELP = "Optional attributes: id names one element, class groups similar elements, and title adds extra hover text.";

function joinTooltip(...parts) {
  return parts.filter(Boolean).join("\n\n");
}

function tooltipWithGlobalAttributes(description, example, explanation, extraHelp = "") {
  return joinTooltip(
    description,
    GLOBAL_ATTRIBUTE_HELP,
    extraHelp,
    `Example: ${example}.`,
    explanation
  );
}

const BLOCK_TOOLTIPS = {
  html_document: joinTooltip(
    "An HTML document is the full web page. The title field becomes the browser tab title.",
    "Useful settings here are lang for the page language, plus html id and class for the root html element. The head styles slot is where CSS rules go.",
    'Example: <html lang="en" id="site-root" class="school-page"> ... <style> body { color: navy; } </style> ... </html>.',
    "Here lang tells the browser and screen readers the page language, id names this one page root, class groups the page for styling, and the style section controls how the page looks."
  ),
  html_comment: joinTooltip(
    "A comment is a note for people reading the code.",
    "Comments do not appear on the web page itself.",
    "Example: <!-- Main menu starts here -->.",
    "This helps humans understand the code."
  ),
  html_heading1: tooltipWithGlobalAttributes(
    "An h1 heading is the main heading on a page.",
    '<h1 id="page-title" class="main-heading" title="This is the main heading">Welcome</h1>',
    "Here id picks this one heading, class can group headings like it, and title shows extra help on hover."
  ),
  html_heading2: tooltipWithGlobalAttributes(
    "An h2 heading is a section heading under the main page heading.",
    '<h2 id="news-title" class="section-heading" title="Section heading">Latest News</h2>',
    "Here id names this heading, class groups similar section headings, and title adds a short hover message."
  ),
  html_heading3: tooltipWithGlobalAttributes(
    "An h3 heading is a smaller heading used inside a section.",
    '<h3 id="tip-title" class="sub-heading" title="Smaller heading">Top Tip</h3>',
    "Here id points to this smaller heading, class groups sub-headings, and title gives extra hover information."
  ),
  html_paragraph: tooltipWithGlobalAttributes(
    "A paragraph shows a block of normal text on the page.",
    '<p id="intro" class="important-text" title="Read this first">Welcome to our class page.</p>',
    "Here id names this paragraph, class can style similar paragraphs, and title gives a hover note."
  ),
  html_link: joinTooltip(
    "A link uses the a tag to connect to another page or resource.",
    GLOBAL_ATTRIBUTE_HELP,
    "Important attributes here are href for the destination and target for where the link opens.",
    'Example: <a href="https://example.com" target="_blank" id="help-link" class="nav-link" title="Open help in a new tab">Help</a>.',
    'Here href gives the web address, target="_blank" opens a new tab, id names this link, class groups similar links, and title adds hover text.'
  ),
  html_image: joinTooltip(
    "An image uses the img tag. The alt text explains the image if it cannot be seen.",
    GLOBAL_ATTRIBUTE_HELP,
    "Important attributes here are src for the file address, alt for the text description, and width and height for the size.",
    'Example: <img src="team-photo.jpg" alt="Year 8 robotics team" width="320" height="200" id="team-photo" class="gallery-image" title="Robotics club photo">.',
    "Here src chooses the image file, alt describes the image, width and height set the display size, id names this image, class groups images, and title adds hover text."
  ),
  html_header: tooltipWithGlobalAttributes(
    "A header usually contains the top area of a page or section, such as a title or navigation.",
    '<header id="top-area" class="site-header" title="Start of the page"> ... </header>',
    "Here id names this header, class groups similar headers, and title adds a hover note."
  ),
  html_nav: tooltipWithGlobalAttributes(
    "A nav section groups navigation links.",
    '<nav id="main-menu" class="site-nav" title="Main menu"> ... </nav>',
    "Here id names the navigation area, class groups navigation sections, and title adds hover text."
  ),
  html_main: tooltipWithGlobalAttributes(
    "The main element holds the main content of the page.",
    '<main id="main-content" class="page-main" title="Main content area"> ... </main>',
    "Here id names the main content area, class groups similar sections, and title adds extra hover information."
  ),
  html_section: tooltipWithGlobalAttributes(
    "A section groups related content together.",
    '<section id="sports-news" class="content-section" title="Sports section"> ... </section>',
    "Here id names this section, class groups similar sections, and title adds a hover message."
  ),
  html_article: tooltipWithGlobalAttributes(
    "An article is a self-contained piece of content, such as a post or news item.",
    '<article id="news-item-1" class="news-story" title="One news story"> ... </article>',
    "Here id names this one article, class groups articles, and title adds extra information on hover."
  ),
  html_div: tooltipWithGlobalAttributes(
    "A div is a general container for grouping content.",
    '<div id="card-1" class="info-card" title="Information card"> ... </div>',
    "Here id names this container, class groups similar containers, and title adds hover text."
  ),
  html_footer: tooltipWithGlobalAttributes(
    "A footer usually contains closing information, contact details, or copyright text.",
    '<footer id="page-footer" class="site-footer" title="Bottom of the page"> ... </footer>',
    "Here id names the footer, class groups footers, and title gives extra hover information."
  ),
  html_ul: tooltipWithGlobalAttributes(
    "An unordered list shows bullet points.",
    '<ul id="materials" class="checklist" title="Items to bring"> ... </ul>',
    "Here id names the list, class groups similar lists, and title adds a hover note."
  ),
  html_ol: joinTooltip(
    "An ordered list shows items in a numbered or lettered order.",
    GLOBAL_ATTRIBUTE_HELP,
    "Important attributes here are start for the first number, type for the marker style, and reversed to count backwards.",
    'Example: <ol start="3" type="A" reversed id="steps" class="process-list" title="Work backwards"> ... </ol>.',
    "Here start begins at 3, type A uses capital letters, reversed counts down, id names this list, class groups similar lists, and title adds hover text."
  ),
  html_li: tooltipWithGlobalAttributes(
    "A list item is one item inside a list.",
    '<li id="item-1" class="menu-item" title="First choice">Science Club</li>',
    "Here id names this one list item, class groups similar items, and title adds a hover note."
  ),
  html_table: tooltipWithGlobalAttributes(
    "A table shows data in rows and columns.",
    '<table id="scores" class="data-table" title="Class scores"> ... </table>',
    "Here id names the table, class groups tables, and title adds extra hover information."
  ),
  html_tr: tooltipWithGlobalAttributes(
    "A table row holds table cells across one row.",
    '<tr id="row-1" class="student-row" title="First student row"> ... </tr>',
    "Here id names this row, class groups similar rows, and title gives a hover message."
  ),
  html_th: joinTooltip(
    "A table heading cell labels a column or row.",
    GLOBAL_ATTRIBUTE_HELP,
    "Important attributes here are colspan and rowspan for how many cells it covers, and scope for whether it labels a row or column.",
    'Example: <th scope="col" colspan="2" id="score-heading" class="table-head" title="Covers two score columns">Scores</th>.',
    "Here scope tells screen readers this is a column heading, colspan makes the heading cover two columns, id names the cell, class groups heading cells, and title adds hover text."
  ),
  html_td: joinTooltip(
    "A table data cell holds the information in a table.",
    GLOBAL_ATTRIBUTE_HELP,
    "Important attributes here are colspan and rowspan for how many cells the data covers.",
    "Example: <td rowspan=\"2\" id=\"sam-score\" class=\"score-cell\" title=\"Sam's score\">18</td>.",
    "Here rowspan makes the data cover two rows, id names this cell, class groups data cells, and title adds a hover note."
  ),
  html_form: joinTooltip(
    "A form collects data from the user.",
    GLOBAL_ATTRIBUTE_HELP,
    "Important attributes here are action for where the data is sent, method for how it is sent, name for a form name, and autocomplete for browser suggestions.",
    'Example: <form action="/submit" method="post" name="contactForm" autocomplete="on" id="contact-form" class="entry-form" title="Send your details"> ... </form>.',
    "Here action gives the destination, method chooses how to send the data, name labels the form, autocomplete lets the browser offer saved answers, id names the form, class groups forms, and title adds hover text."
  ),
  html_label: joinTooltip(
    "A label tells the user what an input is for.",
    GLOBAL_ATTRIBUTE_HELP,
    "The for attribute links the label to an input with the same id.",
    'Example: <label for="name-box" id="name-label" class="form-label" title="Text beside the box">Name</label>.',
    "Here for connects this label to the input whose id is name-box, id names the label, class groups labels, and title adds hover information."
  ),
  html_input: joinTooltip(
    "An input creates a field where the user can enter or choose data.",
    GLOBAL_ATTRIBUTE_HELP,
    "Important attributes here are type for the kind of input, name for the field name, placeholder for a hint, value for the starting value, required to force an answer, and checked for ticked boxes.",
    'Example: <input type="text" name="studentName" placeholder="Enter your name" value="Sam" required id="name-box" class="form-input" title="Type your full name">.',
    "Here type text makes a text box, name labels the field, placeholder shows a hint, value starts with Sam, required means it must be filled in, id names this input, class groups inputs, and title adds hover text. Use checked mainly for checkbox-style inputs."
  ),
  html_button: joinTooltip(
    "A button lets the user trigger an action such as submitting a form.",
    GLOBAL_ATTRIBUTE_HELP,
    "Important attributes here are type for what the button does, name for the button name, and value for the data sent with it.",
    'Example: <button type="submit" name="sendBtn" value="send" id="send-button" class="primary-button" title="Send the form">Send</button>.',
    "Here type submit sends the form, name labels the button, value is the data it sends, id names this button, class groups similar buttons, and title adds hover text."
  ),
  html_figure: tooltipWithGlobalAttributes(
    "A figure groups media such as an image, chart, or diagram with related content.",
    '<figure id="robot-figure" class="media-card" title="Robot photo"> ... </figure>',
    "Here id names the whole figure, class groups similar figures, and title adds hover text."
  ),
  html_figcaption: tooltipWithGlobalAttributes(
    "A figcaption is the label or caption for a figure.",
    '<figcaption id="robot-caption" class="media-caption" title="Image caption">Our robot at the expo</figcaption>',
    "Here id names this caption, class groups captions, and title adds extra hover information."
  ),
  html_picture: tooltipWithGlobalAttributes(
    "A picture element can swap image files for different screen sizes or formats.",
    '<picture id="hero-picture" class="responsive-media" title="Responsive image"> ... </picture>',
    "Inside picture, place one or more picture source blocks and a fallback picture image block."
  ),
  html_picture_source: joinTooltip(
    "A picture source gives one image option inside a picture element.",
    "Use srcset for the image file, media for the screen rule, and type for the file type.",
    'Example: <source srcset="banner-large.jpg" media="(min-width: 900px)" type="image/jpeg">.',
    "Here the browser uses this image when the screen matches the media rule."
  ),
  html_picture_image: joinTooltip(
    "A picture image block is the fallback image inside a picture element.",
    GLOBAL_ATTRIBUTE_HELP,
    'Example: <img src="banner-small.jpg" alt="School banner" width="320" height="180" id="banner-img" class="hero-image" title="Fallback image">.',
    "The browser shows this image if the source rules do not match or if picture sources are not used."
  ),
  html_audio: tooltipWithGlobalAttributes(
    "An audio element plays sound such as music, speech, or sound effects.",
    '<audio id="theme-audio" class="audio-player" title="School song" controls> ... </audio>',
    "Use source blocks inside audio to provide the sound file. Controls shows play and pause buttons."
  ),
  html_video: tooltipWithGlobalAttributes(
    "A video element plays moving video on the page.",
    '<video id="intro-video" class="video-player" title="Intro clip" width="640" height="360" controls poster="poster.jpg"> ... </video>',
    "Use source blocks inside video to provide the video file. Poster shows an image before the video starts."
  ),
  html_media_source: joinTooltip(
    "A media source block adds a file inside an audio or video element.",
    "Use src for the file and type for the media format.",
    'Example: <source src="intro.mp4" type="video/mp4">.',
    "Browsers can choose the first source they support."
  ),
  html_svg: tooltipWithGlobalAttributes(
    "An svg element draws simple vector graphics directly in the page.",
    '<svg width="240" height="120" id="badge-art" class="svg-art" title="Simple badge"> ... </svg>',
    "Put svg shape blocks inside it, such as rectangles, circles, and text."
  ),
  svg_rect: joinTooltip(
    "An SVG rectangle draws a box shape.",
    "Use x and y for position, width and height for size, and fill and stroke for colours.",
    'Example: <rect x="10" y="10" width="80" height="40" fill="blue" stroke="black" />.',
    "This draws a blue rectangle with a black outline."
  ),
  svg_circle: joinTooltip(
    "An SVG circle draws a round shape.",
    "Use x and y for the centre, radius for the size, and fill and stroke for colours.",
    'Example: <circle cx="60" cy="60" r="30" fill="yellow" stroke="black" />.',
    "This draws a yellow circle with a black outline."
  ),
  svg_text: joinTooltip(
    "An SVG text block writes words inside the svg graphic.",
    "Use x and y for position, size for the letter size, and fill for the text colour.",
    'Example: <text x="20" y="50" font-size="24" fill="navy">Hi</text>.',
    "This places the word Hi inside the svg drawing."
  ),
  css_rule_tag: joinTooltip(
    "A CSS tag rule changes every matching HTML tag on the page.",
    "Use the dropdown to choose the tag, then place style declarations inside the rule.",
    "Example:\np {\n  color: navy;\n  font-size: 18px;\n}",
    "Here p selects all paragraphs, color changes the text colour, and font-size makes the text larger."
  ),
  css_rule_class: joinTooltip(
    "A CSS class rule changes every element that has the same class name.",
    "Class rules begin with a dot.",
    "Example:\n.important-text {\n  background-color: yellow;\n  font-weight: bold;\n}",
    "Here .important-text selects every element with class=\"important-text\"."
  ),
  css_rule_id: joinTooltip(
    "A CSS id rule changes one specific element with that id.",
    "Id rules begin with a hash symbol.",
    "Example:\n#page-title {\n  color: darkgreen;\n  text-align: center;\n}",
    "Here #page-title selects the one element with id=\"page-title\"."
  ),
  css_colour_declaration: joinTooltip(
    "A colour declaration changes text colour, background colour, or border colour.",
    "Use the dropdowns to choose the property and colour.",
    "Example: color: blue;",
    "This makes the selected text blue."
  ),
  css_size_declaration: joinTooltip(
    "A size declaration changes how large something is or how much space it has.",
    "Use the property dropdown, then choose a number and unit.",
    "Example: padding: 16px;",
    "This adds 16 pixels of inner space around the content."
  ),
  css_text_align_declaration: joinTooltip(
    "Text align changes where text sits across the page.",
    "Example: text-align: center;",
    "This places the text in the centre."
  ),
  css_font_family_declaration: joinTooltip(
    "Font family changes the look of the letters.",
    "Example: font-family: Georgia;",
    "This changes the text to the Georgia font if it is available."
  ),
  css_font_weight_declaration: joinTooltip(
    "Font weight changes how light or bold the text looks.",
    "Example: font-weight: bold;",
    "This makes the text look bold."
  ),
  css_display_declaration: joinTooltip(
    "Display changes how an element behaves on the page.",
    "Example: display: inline-block;",
    "This lets an element sit inline while still keeping block-style size control."
  ),
  css_border_declaration: joinTooltip(
    "A border declaration adds an outline around an element.",
    "Use the dropdowns and number field to choose width, style, and colour.",
    "Example: border: 2px solid black;",
    "This draws a solid black border that is 2 pixels wide."
  ),
  css_custom_declaration: joinTooltip(
    "A custom declaration lets you type a CSS property and value that are not in the preset blocks.",
    "Use this when you need a style that is not covered by the dropdown blocks.",
    "Example: text-transform: uppercase;",
    "This changes the selected text to capital letters."
  )
};

const CSS_TAG_SELECTOR_OPTIONS = [
  ["body", "body"],
  ["h1", "h1"],
  ["h2", "h2"],
  ["h3", "h3"],
  ["p", "p"],
  ["a", "a"],
  ["img", "img"],
  ["figure", "figure"],
  ["figcaption", "figcaption"],
  ["picture", "picture"],
  ["audio", "audio"],
  ["video", "video"],
  ["svg", "svg"],
  ["header", "header"],
  ["nav", "nav"],
  ["main", "main"],
  ["section", "section"],
  ["article", "article"],
  ["div", "div"],
  ["footer", "footer"],
  ["ul", "ul"],
  ["ol", "ol"],
  ["li", "li"],
  ["table", "table"],
  ["tr", "tr"],
  ["th", "th"],
  ["td", "td"],
  ["form", "form"],
  ["label", "label"],
  ["input", "input"],
  ["button", "button"]
];

const CSS_COLOUR_OPTIONS = [
  ["black", "black"],
  ["white", "white"],
  ["red", "red"],
  ["blue", "blue"],
  ["green", "green"],
  ["yellow", "yellow"],
  ["orange", "orange"],
  ["purple", "purple"],
  ["grey", "grey"],
  ["navy", "navy"],
  ["teal", "teal"],
  ["pink", "pink"]
];

const CSS_COLOUR_PROPERTY_OPTIONS = [
  ["text colour", "color"],
  ["background colour", "background-color"],
  ["border colour", "border-color"]
];

const CSS_SIZE_PROPERTY_OPTIONS = [
  ["font size", "font-size"],
  ["width", "width"],
  ["height", "height"],
  ["margin", "margin"],
  ["padding", "padding"],
  ["border radius", "border-radius"]
];

const CSS_UNIT_OPTIONS = [
  ["px", "px"],
  ["%", "%"],
  ["em", "em"],
  ["rem", "rem"]
];

const CSS_TEXT_ALIGN_OPTIONS = [
  ["left", "left"],
  ["center", "center"],
  ["right", "right"]
];

const CSS_FONT_FAMILY_OPTIONS = [
  ["Arial", "Arial"],
  ["Trebuchet MS", "\"Trebuchet MS\""],
  ["Verdana", "Verdana"],
  ["Georgia", "Georgia"],
  ["Courier New", "\"Courier New\""],
  ["Times New Roman", "\"Times New Roman\""]
];

const CSS_FONT_WEIGHT_OPTIONS = [
  ["normal", "normal"],
  ["bold", "bold"],
  ["lighter", "lighter"]
];

const CSS_DISPLAY_OPTIONS = [
  ["block", "block"],
  ["inline", "inline"],
  ["inline-block", "inline-block"],
  ["flex", "flex"],
  ["none", "none"]
];

const CSS_BORDER_STYLE_OPTIONS = [
  ["solid", "solid"],
  ["dashed", "dashed"],
  ["dotted", "dotted"],
  ["double", "double"]
];

const SVG_COLOUR_OPTIONS = [
  ["none", "none"],
  ["black", "black"],
  ["white", "white"],
  ["red", "red"],
  ["blue", "blue"],
  ["green", "green"],
  ["yellow", "yellow"],
  ["orange", "orange"],
  ["purple", "purple"],
  ["grey", "grey"],
  ["navy", "navy"],
  ["teal", "teal"],
  ["pink", "pink"]
];

const PICTURE_SOURCE_TYPE_OPTIONS = [
  ["default", ""],
  ["image/jpeg", "image/jpeg"],
  ["image/png", "image/png"],
  ["image/webp", "image/webp"],
  ["image/svg+xml", "image/svg+xml"]
];

const MEDIA_SOURCE_TYPE_OPTIONS = [
  ["default", ""],
  ["video/mp4", "video/mp4"],
  ["video/webm", "video/webm"],
  ["video/ogg", "video/ogg"],
  ["audio/mpeg", "audio/mpeg"],
  ["audio/ogg", "audio/ogg"],
  ["audio/wav", "audio/wav"]
];

const LINK_TARGET_OPTIONS = [
  ["default", ""],
  ["new tab", "_blank"],
  ["parent frame", "_parent"],
  ["top window", "_top"]
];

const ORDERED_LIST_TYPE_OPTIONS = [
  ["default", ""],
  ["1", "1"],
  ["A", "A"],
  ["a", "a"],
  ["I", "I"],
  ["i", "i"]
];

const AUTOCOMPLETE_OPTIONS = [
  ["default", ""],
  ["on", "on"],
  ["off", "off"]
];

const HEADER_SCOPE_OPTIONS = [
  ["none", ""],
  ["col", "col"],
  ["row", "row"],
  ["colgroup", "colgroup"],
  ["rowgroup", "rowgroup"]
];

const GLOBAL_ATTRIBUTE_LINES = [
  {
    message: "id %1 class %2 title %3",
    args: [
      {type: "field_input", name: "ID", text: ""},
      {type: "field_input", name: "CLASS", text: ""},
      {type: "field_input", name: "TITLE_ATTR", text: ""}
    ]
  }
];

const DOCUMENT_ATTRIBUTE_LINES = [
  {
    message: "html id %1 class %2",
    args: [
      {type: "field_input", name: "HTML_ID", text: ""},
      {type: "field_input", name: "HTML_CLASS", text: ""}
    ]
  }
];

const LINK_ATTRIBUTE_LINES = [
  {
    message: "target %1",
    args: [
      {type: "field_dropdown", name: "TARGET", options: LINK_TARGET_OPTIONS}
    ]
  }
];

const IMAGE_ATTRIBUTE_LINES = [
  {
    message: "width %1 height %2",
    args: [
      {type: "field_input", name: "WIDTH", text: ""},
      {type: "field_input", name: "HEIGHT", text: ""}
    ]
  }
];

const VIDEO_ATTRIBUTE_LINES = [
  {
    message: "controls %1 autoplay %2 loop %3 muted %4",
    args: [
      {type: "field_checkbox", name: "CONTROLS", checked: true},
      {type: "field_checkbox", name: "AUTOPLAY", checked: false},
      {type: "field_checkbox", name: "LOOP", checked: false},
      {type: "field_checkbox", name: "MUTED", checked: false}
    ]
  },
  {
    message: "poster %1",
    args: [
      {type: "field_input", name: "POSTER", text: ""}
    ]
  }
];

const AUDIO_ATTRIBUTE_LINES = [
  {
    message: "controls %1 autoplay %2 loop %3 muted %4",
    args: [
      {type: "field_checkbox", name: "CONTROLS", checked: true},
      {type: "field_checkbox", name: "AUTOPLAY", checked: false},
      {type: "field_checkbox", name: "LOOP", checked: false},
      {type: "field_checkbox", name: "MUTED", checked: false}
    ]
  }
];

const ORDERED_LIST_ATTRIBUTE_LINES = [
  {
    message: "start %1 type %2 reversed %3",
    args: [
      {type: "field_input", name: "START", text: ""},
      {type: "field_dropdown", name: "LIST_TYPE", options: ORDERED_LIST_TYPE_OPTIONS},
      {type: "field_checkbox", name: "REVERSED", checked: false}
    ]
  }
];

const FORM_ATTRIBUTE_LINES = [
  {
    message: "name %1 autocomplete %2",
    args: [
      {type: "field_input", name: "NAME", text: ""},
      {type: "field_dropdown", name: "AUTOCOMPLETE", options: AUTOCOMPLETE_OPTIONS}
    ]
  }
];

const INPUT_ATTRIBUTE_LINES = [
  {
    message: "value %1 required %2 checked %3",
    args: [
      {type: "field_input", name: "VALUE", text: ""},
      {type: "field_checkbox", name: "REQUIRED", checked: false},
      {type: "field_checkbox", name: "CHECKED", checked: false}
    ]
  }
];

const BUTTON_ATTRIBUTE_LINES = [
  {
    message: "name %1 value %2",
    args: [
      {type: "field_input", name: "NAME", text: ""},
      {type: "field_input", name: "VALUE", text: ""}
    ]
  }
];

const HEADER_CELL_ATTRIBUTE_LINES = [
  {
    message: "colspan %1 rowspan %2 scope %3",
    args: [
      {type: "field_number", name: "COLSPAN", value: 1, min: 1, precision: 1},
      {type: "field_number", name: "ROWSPAN", value: 1, min: 1, precision: 1},
      {type: "field_dropdown", name: "SCOPE", options: HEADER_SCOPE_OPTIONS}
    ]
  }
];

const DATA_CELL_ATTRIBUTE_LINES = [
  {
    message: "colspan %1 rowspan %2",
    args: [
      {type: "field_number", name: "COLSPAN", value: 1, min: 1, precision: 1},
      {type: "field_number", name: "ROWSPAN", value: 1, min: 1, precision: 1}
    ]
  }
];

const GLOBAL_ATTRIBUTE_SPECS = [
  {attribute: "id", field: "ID"},
  {attribute: "class", field: "CLASS"},
  {attribute: "title", field: "TITLE_ATTR"}
];

const DOCUMENT_ROOT_ATTRIBUTE_SPECS = [
  {attribute: "id", field: "HTML_ID"},
  {attribute: "class", field: "HTML_CLASS"}
];

const LINK_ATTRIBUTE_SPECS = [
  {attribute: "target", field: "TARGET"}
];

const IMAGE_ATTRIBUTE_SPECS = [
  {attribute: "width", field: "WIDTH"},
  {attribute: "height", field: "HEIGHT"}
];

const AUDIO_ATTRIBUTE_SPECS = [
  {attribute: "controls", field: "CONTROLS", type: "boolean"},
  {attribute: "autoplay", field: "AUTOPLAY", type: "boolean"},
  {attribute: "loop", field: "LOOP", type: "boolean"},
  {attribute: "muted", field: "MUTED", type: "boolean"}
];

const VIDEO_ATTRIBUTE_SPECS = [
  {attribute: "width", field: "WIDTH"},
  {attribute: "height", field: "HEIGHT"},
  {attribute: "poster", field: "POSTER"},
  {attribute: "controls", field: "CONTROLS", type: "boolean"},
  {attribute: "autoplay", field: "AUTOPLAY", type: "boolean"},
  {attribute: "loop", field: "LOOP", type: "boolean"},
  {attribute: "muted", field: "MUTED", type: "boolean"}
];

const ORDERED_LIST_ATTRIBUTE_SPECS = [
  {attribute: "start", field: "START"},
  {attribute: "type", field: "LIST_TYPE"},
  {attribute: "reversed", field: "REVERSED", type: "boolean"}
];

const FORM_ATTRIBUTE_SPECS = [
  {attribute: "name", field: "NAME"},
  {attribute: "autocomplete", field: "AUTOCOMPLETE"}
];

const INPUT_ATTRIBUTE_SPECS = [
  {attribute: "value", field: "VALUE"},
  {attribute: "required", field: "REQUIRED", type: "boolean"},
  {attribute: "checked", field: "CHECKED", type: "boolean"}
];

const BUTTON_ATTRIBUTE_SPECS = [
  {attribute: "name", field: "NAME"},
  {attribute: "value", field: "VALUE"}
];

const HEADER_CELL_ATTRIBUTE_SPECS = [
  {attribute: "colspan", field: "COLSPAN", omitIf: (value) => value === "1"},
  {attribute: "rowspan", field: "ROWSPAN", omitIf: (value) => value === "1"},
  {attribute: "scope", field: "SCOPE"}
];

const DATA_CELL_ATTRIBUTE_SPECS = [
  {attribute: "colspan", field: "COLSPAN", omitIf: (value) => value === "1"},
  {attribute: "rowspan", field: "ROWSPAN", omitIf: (value) => value === "1"}
];

const dom = {
  appLayout: document.querySelector(".app-layout"),
  blocklyHost: document.querySelector("#blocklyHost"),
  panelResizer: document.querySelector("#panelResizer"),
  outputPreview: document.querySelector("#outputPreview"),
  livePreviewFrame: document.querySelector("#livePreviewFrame"),
  workspaceSummary: document.querySelector("#workspaceSummary"),
  validationBanner: document.querySelector("#validationBanner"),
  saveStatus: document.querySelector("#saveStatus"),
  saveProjectBtn: document.querySelector("#saveProjectBtn"),
  loadProjectBtn: document.querySelector("#loadProjectBtn"),
  copyOutputBtn: document.querySelector("#copyOutputBtn"),
  clearWorkspaceBtn: document.querySelector("#clearWorkspaceBtn"),
  loadProjectInput: document.querySelector("#loadProjectInput")
};

let workspace = null;
let autosaveTimer = 0;
let statusResetTimer = 0;
let isApplyingWorkspaceState = false;
let workspaceResizeFrame = 0;
let panelResizeState = null;

function queueWorkspaceResize() {
  if (!workspace || workspaceResizeFrame) {
    return;
  }

  workspaceResizeFrame = window.requestAnimationFrame(() => {
    workspaceResizeFrame = 0;
    Blockly.svgResize(workspace);
  });
}

function getPreviewWidthLimits() {
  const layoutWidth = dom.appLayout ? dom.appLayout.clientWidth : 0;
  const maxByLayout = layoutWidth
    ? layoutWidth - MIN_WORKSPACE_WIDTH - 16
    : MAX_PREVIEW_WIDTH;

  return {
    min: MIN_PREVIEW_WIDTH,
    max: Math.max(MIN_PREVIEW_WIDTH, Math.min(MAX_PREVIEW_WIDTH, maxByLayout))
  };
}

function clampPreviewWidth(width) {
  const {min, max} = getPreviewWidthLimits();
  return Math.max(min, Math.min(max, Math.round(width)));
}

function getCurrentPreviewWidth() {
  if (!dom.appLayout) {
    return DEFAULT_PREVIEW_WIDTH;
  }

  const styleValue = Number.parseFloat(getComputedStyle(dom.appLayout).getPropertyValue("--preview-width"));
  return Number.isFinite(styleValue) ? styleValue : DEFAULT_PREVIEW_WIDTH;
}

function updatePanelResizerAria(width = getCurrentPreviewWidth()) {
  if (!dom.panelResizer) {
    return;
  }

  const {min, max} = getPreviewWidthLimits();
  dom.panelResizer.setAttribute("aria-valuemin", String(min));
  dom.panelResizer.setAttribute("aria-valuemax", String(max));
  dom.panelResizer.setAttribute("aria-valuenow", String(clampPreviewWidth(width)));
}

function storePreviewWidth(width) {
  try {
    localStorage.setItem(PREVIEW_WIDTH_STORAGE_KEY, String(width));
  } catch (error) {
  }
}

function applyPreviewWidth(width, {persist = true} = {}) {
  if (!dom.appLayout) {
    return;
  }

  const nextWidth = clampPreviewWidth(width);
  dom.appLayout.style.setProperty("--preview-width", `${nextWidth}px`);
  updatePanelResizerAria(nextWidth);

  if (persist) {
    storePreviewWidth(nextWidth);
  }
}

function restorePreviewWidth() {
  let restoredWidth = DEFAULT_PREVIEW_WIDTH;

  try {
    const saved = Number.parseFloat(localStorage.getItem(PREVIEW_WIDTH_STORAGE_KEY));
    if (Number.isFinite(saved)) {
      restoredWidth = saved;
    }
  } catch (error) {
  }

  applyPreviewWidth(restoredWidth, {persist: false});
}

function beginPanelResize(event) {
  if (!dom.panelResizer || event.button !== 0 || window.matchMedia("(max-width: 1240px)").matches) {
    return;
  }

  event.preventDefault();
  panelResizeState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startWidth: getCurrentPreviewWidth()
  };
  dom.panelResizer.classList.add("is-dragging");
  document.body.classList.add("is-resizing-panels");
  dom.panelResizer.setPointerCapture(event.pointerId);
}

function updatePanelResize(event) {
  if (!panelResizeState || event.pointerId !== panelResizeState.pointerId) {
    return;
  }

  const delta = panelResizeState.startX - event.clientX;
  applyPreviewWidth(panelResizeState.startWidth + delta, {persist: false});
  queueWorkspaceResize();
}

function finishPanelResize(event) {
  if (!panelResizeState || event.pointerId !== panelResizeState.pointerId) {
    return;
  }

  if (dom.panelResizer?.hasPointerCapture(event.pointerId)) {
    dom.panelResizer.releasePointerCapture(event.pointerId);
  }

  applyPreviewWidth(getCurrentPreviewWidth());
  dom.panelResizer.classList.remove("is-dragging");
  document.body.classList.remove("is-resizing-panels");
  panelResizeState = null;
  queueWorkspaceResize();
}

function cancelPanelResize() {
  if (!panelResizeState) {
    return;
  }

  dom.panelResizer.classList.remove("is-dragging");
  document.body.classList.remove("is-resizing-panels");
  panelResizeState = null;
  queueWorkspaceResize();
}

function handlePanelResizerKeydown(event) {
  if (window.matchMedia("(max-width: 1240px)").matches) {
    return;
  }

  const currentWidth = getCurrentPreviewWidth();
  const {min, max} = getPreviewWidthLimits();
  let nextWidth = null;

  if (event.key === "ArrowLeft") {
    nextWidth = currentWidth + PREVIEW_RESIZE_STEP;
  } else if (event.key === "ArrowRight") {
    nextWidth = currentWidth - PREVIEW_RESIZE_STEP;
  } else if (event.key === "Home") {
    nextWidth = min;
  } else if (event.key === "End") {
    nextWidth = max;
  }

  if (nextWidth === null) {
    return;
  }

  event.preventDefault();
  applyPreviewWidth(nextWidth);
  queueWorkspaceResize();
}

function defineBlocklyTheme() {
  return Blockly.Theme.defineTheme("blocklyHtmlTheme", {
    base: Blockly.Themes.Classic,
    blockStyles: {
      document_blocks: {
        colourPrimary: CATEGORY_COLOURS.document,
        colourSecondary: "#224fb2",
        colourTertiary: "#183f92"
      },
      text_blocks: {
        colourPrimary: CATEGORY_COLOURS.text,
        colourSecondary: "#236a56",
        colourTertiary: "#1b5546"
      },
      structure_blocks: {
        colourPrimary: CATEGORY_COLOURS.structure,
        colourSecondary: "#4a4390",
        colourTertiary: "#393271"
      },
      media_blocks: {
        colourPrimary: CATEGORY_COLOURS.media,
        colourSecondary: "#a75b17",
        colourTertiary: "#8d4c10"
      },
      lists_blocks: {
        colourPrimary: CATEGORY_COLOURS.lists,
        colourSecondary: "#74344a",
        colourTertiary: "#5d2538"
      },
      tables_blocks: {
        colourPrimary: CATEGORY_COLOURS.tables,
        colourSecondary: "#32597a",
        colourTertiary: "#26445d"
      },
      forms_blocks: {
        colourPrimary: CATEGORY_COLOURS.forms,
        colourSecondary: "#684b1a",
        colourTertiary: "#523b13"
      },
      css_blocks: {
        colourPrimary: CATEGORY_COLOURS.css,
        colourSecondary: "#255c61",
        colourTertiary: "#1c474b"
      }
    },
    categoryStyles: {
      document_category: {colour: CATEGORY_COLOURS.document},
      text_category: {colour: CATEGORY_COLOURS.text},
      structure_category: {colour: CATEGORY_COLOURS.structure},
      media_category: {colour: CATEGORY_COLOURS.media},
      lists_category: {colour: CATEGORY_COLOURS.lists},
      tables_category: {colour: CATEGORY_COLOURS.tables},
      forms_category: {colour: CATEGORY_COLOURS.forms},
      css_category: {colour: CATEGORY_COLOURS.css}
    },
    componentStyles: {
      workspaceBackgroundColour: "#f8fbff",
      toolboxBackgroundColour: "#f3f7ff",
      toolboxForegroundColour: "#152033",
      flyoutBackgroundColour: "#f8fbff",
      flyoutForegroundColour: "#152033",
      flyoutOpacity: 1,
      scrollbarColour: "#b9c6e5",
      insertionMarkerColour: "#2d5ecf",
      insertionMarkerOpacity: 0.35,
      markerColour: "#2d5ecf",
      cursorColour: "#2d5ecf"
    },
    fontStyle: {
      family: "\"Trebuchet MS\", \"Segoe UI\", sans-serif",
      weight: "300",
      size: 12
    }
  });
}

function escapeHtmlText(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value) {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function escapeComment(value) {
  return String(value || "").replace(/--/g, "- -");
}

function getFieldValue(block, fieldName) {
  return String(block.getFieldValue(fieldName) || "").trim();
}

function sanitizeCssIdentifier(value) {
  return String(value || "").trim().replace(/[^\w-]/g, "");
}

function sanitizeCssValue(value) {
  return String(value || "").trim().replace(/[{}]/g, "");
}

function cloneArgDefinition(arg) {
  const clone = {...arg};

  if (Array.isArray(arg.options)) {
    clone.options = arg.options.map((option) => option.slice());
  }

  return clone;
}

function mergeAttributeLines(...lineGroups) {
  const mergedArgs = [];
  const mergedMessageParts = [];

  lineGroups.flat().forEach((line) => {
    if (!line || !Array.isArray(line.args) || line.args.length === 0) {
      return;
    }

    const argOffset = mergedArgs.length;
    const remappedMessage = line.message.replace(/%(\d+)/g, (_, index) => {
      return `%${Number(index) + argOffset}`;
    });

    mergedMessageParts.push(remappedMessage);
    mergedArgs.push(...line.args.map(cloneArgDefinition));
  });

  if (mergedMessageParts.length === 0) {
    return [];
  }

  return [
    {
      message: mergedMessageParts.join(" "),
      args: mergedArgs
    }
  ];
}

function createBlockDefinition(config) {
  const {
    type,
    lines,
    style,
    tooltip,
    previousStatement,
    nextStatement
  } = config;
  const definition = {type, style, tooltip};

  lines.forEach((line, index) => {
    definition[`message${index}`] = line.message;
    if (Array.isArray(line.args) && line.args.length > 0) {
      definition[`args${index}`] = line.args.map(cloneArgDefinition);
    }
  });

  if (previousStatement !== undefined) {
    definition.previousStatement = previousStatement;
  }

  if (nextStatement !== undefined) {
    definition.nextStatement = nextStatement;
  }

  return definition;
}

function createTextFlowBlock({
  type,
  label,
  defaultText,
  style,
  tooltip,
  previousStatement = "html_flow",
  nextStatement = "html_flow"
}) {
  return createBlockDefinition({
    type,
    lines: [
      {
        message: `${label} %1`,
        args: [
          {type: "field_input", name: "TEXT", text: defaultText}
        ]
      },
      ...GLOBAL_ATTRIBUTE_LINES
    ],
    previousStatement,
    nextStatement,
    style,
    tooltip
  });
}

function createContainerFlowBlock({
  type,
  label,
  style,
  tooltip,
  inputName = "CONTENT",
  inputCheck = "html_flow",
  previousStatement = "html_flow",
  nextStatement = "html_flow",
  attributeLines = GLOBAL_ATTRIBUTE_LINES
}) {
  return createBlockDefinition({
    type,
    lines: [
      {message: label},
      ...attributeLines,
      {
        message: "%1",
        args: [
          {type: "input_statement", name: inputName, check: inputCheck}
        ]
      }
    ],
    previousStatement,
    nextStatement,
    style,
    tooltip
  });
}

function createCssRuleBlock({type, label, args, tooltip}) {
  return createBlockDefinition({
    type,
    lines: [
      {
        message: label,
        args
      },
      {
        message: "%1",
        args: [
          {type: "input_statement", name: "DECLARATIONS", check: "css_declaration"}
        ]
      }
    ],
    previousStatement: "css_rule",
    nextStatement: "css_rule",
    style: "css_blocks",
    tooltip
  });
}

function createCssDeclarationBlock({type, label, args, tooltip}) {
  return createBlockDefinition({
    type,
    lines: [
      {
        message: label,
        args
      }
    ],
    previousStatement: "css_declaration",
    nextStatement: "css_declaration",
    style: "css_blocks",
    tooltip
  });
}

function defineCustomBlocks() {
  const blockDefinitions = [
    createBlockDefinition({
      type: "html_document",
      lines: [
        {
          message: "HTML document title %1 lang %2",
          args: [
            {type: "field_input", name: "TITLE", text: "My Web Page"},
            {type: "field_input", name: "LANG", text: "en"}
          ]
        },
        ...DOCUMENT_ATTRIBUTE_LINES,
        {
          message: "head styles %1",
          args: [
            {type: "input_statement", name: "STYLES", check: "css_rule"}
          ]
        },
        {
          message: "body %1",
          args: [
            {type: "input_statement", name: "BODY", check: "html_flow"}
          ]
        }
      ],
      style: "document_blocks",
      tooltip: BLOCK_TOOLTIPS.html_document
    }),
    createBlockDefinition({
      type: "html_comment",
      lines: [
        {
          message: "comment %1",
          args: [
            {type: "field_input", name: "TEXT", text: "Page note"}
          ]
        }
      ],
      previousStatement: "html_flow",
      nextStatement: "html_flow",
      style: "document_blocks",
      tooltip: BLOCK_TOOLTIPS.html_comment
    }),
    createTextFlowBlock({
      type: "html_heading1",
      label: "h1",
      defaultText: "Main heading",
      style: "text_blocks",
      tooltip: BLOCK_TOOLTIPS.html_heading1
    }),
    createTextFlowBlock({
      type: "html_heading2",
      label: "h2",
      defaultText: "Section heading",
      style: "text_blocks",
      tooltip: BLOCK_TOOLTIPS.html_heading2
    }),
    createTextFlowBlock({
      type: "html_heading3",
      label: "h3",
      defaultText: "Smaller heading",
      style: "text_blocks",
      tooltip: BLOCK_TOOLTIPS.html_heading3
    }),
    createTextFlowBlock({
      type: "html_paragraph",
      label: "paragraph",
      defaultText: "Write your paragraph here.",
      style: "text_blocks",
      tooltip: BLOCK_TOOLTIPS.html_paragraph
    }),
    createBlockDefinition({
      type: "html_link",
      lines: [
        {
          message: "link text %1 href %2",
          args: [
            {type: "field_input", name: "TEXT", text: "Visit page"},
            {type: "field_input", name: "HREF", text: "https://example.com"}
          ]
        },
        ...mergeAttributeLines(LINK_ATTRIBUTE_LINES, GLOBAL_ATTRIBUTE_LINES)
      ],
      previousStatement: "html_flow",
      nextStatement: "html_flow",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_link
    }),
    createBlockDefinition({
      type: "html_image",
      lines: [
        {
          message: "image src %1 alt %2",
          args: [
            {type: "field_input", name: "SRC", text: "image.png"},
            {type: "field_input", name: "ALT", text: "Describe the image"}
          ]
        },
        ...mergeAttributeLines(IMAGE_ATTRIBUTE_LINES, GLOBAL_ATTRIBUTE_LINES)
      ],
      previousStatement: "html_flow",
      nextStatement: "html_flow",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_image
    }),
    createContainerFlowBlock({
      type: "html_figure",
      label: "figure",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_figure
    }),
    createTextFlowBlock({
      type: "html_figcaption",
      label: "figcaption",
      defaultText: "Caption text",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_figcaption
    }),
    createContainerFlowBlock({
      type: "html_picture",
      label: "picture",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_picture,
      inputName: "SOURCES",
      inputCheck: "html_picture_child"
    }),
    createBlockDefinition({
      type: "html_picture_source",
      lines: [
        {
          message: "picture source srcset %1 media %2",
          args: [
            {type: "field_input", name: "SRCSET", text: "banner-large.jpg"},
            {type: "field_input", name: "MEDIA", text: "(min-width: 900px)"}
          ]
        },
        {
          message: "type %1",
          args: [
            {
              type: "field_dropdown",
              name: "TYPE",
              options: PICTURE_SOURCE_TYPE_OPTIONS
            }
          ]
        }
      ],
      previousStatement: "html_picture_child",
      nextStatement: "html_picture_child",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_picture_source
    }),
    createBlockDefinition({
      type: "html_picture_image",
      lines: [
        {
          message: "picture image src %1 alt %2",
          args: [
            {type: "field_input", name: "SRC", text: "banner-small.jpg"},
            {type: "field_input", name: "ALT", text: "Describe the image"}
          ]
        },
        ...mergeAttributeLines(IMAGE_ATTRIBUTE_LINES, GLOBAL_ATTRIBUTE_LINES)
      ],
      previousStatement: "html_picture_child",
      nextStatement: "html_picture_child",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_picture_image
    }),
    createBlockDefinition({
      type: "html_audio",
      lines: [
        {message: "audio"},
        ...AUDIO_ATTRIBUTE_LINES,
        ...GLOBAL_ATTRIBUTE_LINES,
        {
          message: "%1",
          args: [
            {type: "input_statement", name: "SOURCES", check: "html_media_source"}
          ]
        }
      ],
      previousStatement: "html_flow",
      nextStatement: "html_flow",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_audio
    }),
    createBlockDefinition({
      type: "html_video",
      lines: [
        {
          message: "video width %1 height %2",
          args: [
            {type: "field_input", name: "WIDTH", text: "640"},
            {type: "field_input", name: "HEIGHT", text: "360"}
          ]
        },
        ...VIDEO_ATTRIBUTE_LINES,
        ...GLOBAL_ATTRIBUTE_LINES,
        {
          message: "%1",
          args: [
            {type: "input_statement", name: "SOURCES", check: "html_media_source"}
          ]
        }
      ],
      previousStatement: "html_flow",
      nextStatement: "html_flow",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_video
    }),
    createBlockDefinition({
      type: "html_media_source",
      lines: [
        {
          message: "media source src %1 type %2",
          args: [
            {type: "field_input", name: "SRC", text: "intro.mp4"},
            {
              type: "field_dropdown",
              name: "TYPE",
              options: MEDIA_SOURCE_TYPE_OPTIONS
            }
          ]
        }
      ],
      previousStatement: "html_media_source",
      nextStatement: "html_media_source",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_media_source
    }),
    createBlockDefinition({
      type: "html_svg",
      lines: [
        {
          message: "svg width %1 height %2",
          args: [
            {type: "field_input", name: "WIDTH", text: "240"},
            {type: "field_input", name: "HEIGHT", text: "120"}
          ]
        },
        ...GLOBAL_ATTRIBUTE_LINES,
        {
          message: "%1",
          args: [
            {type: "input_statement", name: "SHAPES", check: "svg_shape"}
          ]
        }
      ],
      previousStatement: "html_flow",
      nextStatement: "html_flow",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.html_svg
    }),
    createBlockDefinition({
      type: "svg_rect",
      lines: [
        {
          message: "svg rectangle x %1 y %2 width %3 height %4",
          args: [
            {type: "field_number", name: "X", value: 10, min: 0, precision: 1},
            {type: "field_number", name: "Y", value: 10, min: 0, precision: 1},
            {type: "field_number", name: "WIDTH", value: 80, min: 0, precision: 1},
            {type: "field_number", name: "HEIGHT", value: 40, min: 0, precision: 1}
          ]
        },
        {
          message: "fill %1 stroke %2",
          args: [
            {type: "field_dropdown", name: "FILL", options: SVG_COLOUR_OPTIONS},
            {type: "field_dropdown", name: "STROKE", options: SVG_COLOUR_OPTIONS}
          ]
        }
      ],
      previousStatement: "svg_shape",
      nextStatement: "svg_shape",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.svg_rect
    }),
    createBlockDefinition({
      type: "svg_circle",
      lines: [
        {
          message: "svg circle x %1 y %2 radius %3",
          args: [
            {type: "field_number", name: "CX", value: 60, min: 0, precision: 1},
            {type: "field_number", name: "CY", value: 60, min: 0, precision: 1},
            {type: "field_number", name: "R", value: 30, min: 0, precision: 1}
          ]
        },
        {
          message: "fill %1 stroke %2",
          args: [
            {type: "field_dropdown", name: "FILL", options: SVG_COLOUR_OPTIONS},
            {type: "field_dropdown", name: "STROKE", options: SVG_COLOUR_OPTIONS}
          ]
        }
      ],
      previousStatement: "svg_shape",
      nextStatement: "svg_shape",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.svg_circle
    }),
    createBlockDefinition({
      type: "svg_text",
      lines: [
        {
          message: "svg text %1",
          args: [
            {type: "field_input", name: "TEXT", text: "Hello"}
          ]
        },
        {
          message: "x %1 y %2 size %3 fill %4",
          args: [
            {type: "field_number", name: "X", value: 20, min: 0, precision: 1},
            {type: "field_number", name: "Y", value: 50, min: 0, precision: 1},
            {type: "field_number", name: "SIZE", value: 24, min: 1, precision: 1},
            {type: "field_dropdown", name: "FILL", options: SVG_COLOUR_OPTIONS}
          ]
        }
      ],
      previousStatement: "svg_shape",
      nextStatement: "svg_shape",
      style: "media_blocks",
      tooltip: BLOCK_TOOLTIPS.svg_text
    }),
    createContainerFlowBlock({
      type: "html_header",
      label: "header",
      style: "structure_blocks",
      tooltip: BLOCK_TOOLTIPS.html_header
    }),
    createContainerFlowBlock({
      type: "html_nav",
      label: "nav",
      style: "structure_blocks",
      tooltip: BLOCK_TOOLTIPS.html_nav
    }),
    createContainerFlowBlock({
      type: "html_main",
      label: "main",
      style: "structure_blocks",
      tooltip: BLOCK_TOOLTIPS.html_main
    }),
    createContainerFlowBlock({
      type: "html_section",
      label: "section",
      style: "structure_blocks",
      tooltip: BLOCK_TOOLTIPS.html_section
    }),
    createContainerFlowBlock({
      type: "html_article",
      label: "article",
      style: "structure_blocks",
      tooltip: BLOCK_TOOLTIPS.html_article
    }),
    createContainerFlowBlock({
      type: "html_div",
      label: "div",
      style: "structure_blocks",
      tooltip: BLOCK_TOOLTIPS.html_div
    }),
    createContainerFlowBlock({
      type: "html_footer",
      label: "footer",
      style: "structure_blocks",
      tooltip: BLOCK_TOOLTIPS.html_footer
    }),
    createContainerFlowBlock({
      type: "html_ul",
      label: "unordered list",
      style: "lists_blocks",
      tooltip: BLOCK_TOOLTIPS.html_ul,
      inputName: "ITEMS",
      inputCheck: "html_list_item"
    }),
    createContainerFlowBlock({
      type: "html_ol",
      label: "ordered list",
      style: "lists_blocks",
      tooltip: BLOCK_TOOLTIPS.html_ol,
      inputName: "ITEMS",
      inputCheck: "html_list_item",
      attributeLines: mergeAttributeLines(ORDERED_LIST_ATTRIBUTE_LINES, GLOBAL_ATTRIBUTE_LINES)
    }),
    createTextFlowBlock({
      type: "html_li",
      label: "list item",
      defaultText: "List item",
      style: "lists_blocks",
      tooltip: BLOCK_TOOLTIPS.html_li,
      previousStatement: "html_list_item",
      nextStatement: "html_list_item"
    }),
    createContainerFlowBlock({
      type: "html_table",
      label: "table",
      style: "tables_blocks",
      tooltip: BLOCK_TOOLTIPS.html_table,
      inputName: "ROWS",
      inputCheck: "html_table_row"
    }),
    createContainerFlowBlock({
      type: "html_tr",
      label: "table row",
      style: "tables_blocks",
      tooltip: BLOCK_TOOLTIPS.html_tr,
      inputName: "CELLS",
      inputCheck: "html_table_cell",
      previousStatement: "html_table_row",
      nextStatement: "html_table_row"
    }),
    createBlockDefinition({
      type: "html_th",
      lines: [
        {
          message: "heading cell %1",
          args: [
            {type: "field_input", name: "TEXT", text: "Heading"}
          ]
        },
        ...mergeAttributeLines(HEADER_CELL_ATTRIBUTE_LINES, GLOBAL_ATTRIBUTE_LINES)
      ],
      previousStatement: "html_table_cell",
      nextStatement: "html_table_cell",
      style: "tables_blocks",
      tooltip: BLOCK_TOOLTIPS.html_th
    }),
    createBlockDefinition({
      type: "html_td",
      lines: [
        {
          message: "data cell %1",
          args: [
            {type: "field_input", name: "TEXT", text: "Value"}
          ]
        },
        ...mergeAttributeLines(DATA_CELL_ATTRIBUTE_LINES, GLOBAL_ATTRIBUTE_LINES)
      ],
      previousStatement: "html_table_cell",
      nextStatement: "html_table_cell",
      style: "tables_blocks",
      tooltip: BLOCK_TOOLTIPS.html_td
    }),
    createBlockDefinition({
      type: "html_form",
      lines: [
        {
          message: "form action %1 method %2",
          args: [
            {type: "field_input", name: "ACTION", text: "/submit"},
            {
              type: "field_dropdown",
              name: "METHOD",
              options: [
                ["GET", "get"],
                ["POST", "post"]
              ]
            }
          ]
        },
        ...mergeAttributeLines(FORM_ATTRIBUTE_LINES, GLOBAL_ATTRIBUTE_LINES),
        {
          message: "%1",
          args: [
            {type: "input_statement", name: "CONTROLS", check: "html_flow"}
          ]
        }
      ],
      previousStatement: "html_flow",
      nextStatement: "html_flow",
      style: "forms_blocks",
      tooltip: BLOCK_TOOLTIPS.html_form
    }),
    createBlockDefinition({
      type: "html_label",
      lines: [
        {
          message: "label text %1 for %2",
          args: [
            {type: "field_input", name: "TEXT", text: "Name"},
            {type: "field_input", name: "FOR", text: "name-input"}
          ]
        },
        ...GLOBAL_ATTRIBUTE_LINES
      ],
      previousStatement: "html_flow",
      nextStatement: "html_flow",
      style: "forms_blocks",
      tooltip: BLOCK_TOOLTIPS.html_label
    }),
    createBlockDefinition({
      type: "html_input",
      lines: [
        {
          message: "input type %1 name %2 placeholder %3",
          args: [
            {
              type: "field_dropdown",
              name: "TYPE",
              options: [
                ["text", "text"],
                ["email", "email"],
                ["number", "number"],
                ["password", "password"],
                ["date", "date"],
                ["checkbox", "checkbox"]
              ]
            },
            {type: "field_input", name: "NAME", text: "name"},
            {type: "field_input", name: "PLACEHOLDER", text: "Enter text"}
          ]
        },
        ...mergeAttributeLines(INPUT_ATTRIBUTE_LINES, GLOBAL_ATTRIBUTE_LINES)
      ],
      previousStatement: "html_flow",
      nextStatement: "html_flow",
      style: "forms_blocks",
      tooltip: BLOCK_TOOLTIPS.html_input
    }),
    createBlockDefinition({
      type: "html_button",
      lines: [
        {
          message: "button text %1 type %2",
          args: [
            {type: "field_input", name: "TEXT", text: "Send"},
            {
              type: "field_dropdown",
              name: "TYPE",
              options: [
                ["button", "button"],
                ["submit", "submit"],
                ["reset", "reset"]
              ]
            }
          ]
        },
        ...mergeAttributeLines(BUTTON_ATTRIBUTE_LINES, GLOBAL_ATTRIBUTE_LINES)
      ],
      previousStatement: "html_flow",
      nextStatement: "html_flow",
      style: "forms_blocks",
      tooltip: BLOCK_TOOLTIPS.html_button
    }),
    createCssRuleBlock({
      type: "css_rule_tag",
      label: "style tag %1",
      args: [
        {
          type: "field_dropdown",
          name: "SELECTOR",
          options: CSS_TAG_SELECTOR_OPTIONS
        }
      ],
      tooltip: BLOCK_TOOLTIPS.css_rule_tag
    }),
    createCssRuleBlock({
      type: "css_rule_class",
      label: "style class . %1",
      args: [
        {type: "field_input", name: "SELECTOR", text: "important-text"}
      ],
      tooltip: BLOCK_TOOLTIPS.css_rule_class
    }),
    createCssRuleBlock({
      type: "css_rule_id",
      label: "style id # %1",
      args: [
        {type: "field_input", name: "SELECTOR", text: "page-title"}
      ],
      tooltip: BLOCK_TOOLTIPS.css_rule_id
    }),
    createCssDeclarationBlock({
      type: "css_colour_declaration",
      label: "set %1 to %2",
      args: [
        {
          type: "field_dropdown",
          name: "PROPERTY",
          options: CSS_COLOUR_PROPERTY_OPTIONS
        },
        {
          type: "field_dropdown",
          name: "VALUE",
          options: CSS_COLOUR_OPTIONS
        }
      ],
      tooltip: BLOCK_TOOLTIPS.css_colour_declaration
    }),
    createCssDeclarationBlock({
      type: "css_size_declaration",
      label: "set %1 to %2 %3",
      args: [
        {
          type: "field_dropdown",
          name: "PROPERTY",
          options: CSS_SIZE_PROPERTY_OPTIONS
        },
        {
          type: "field_number",
          name: "VALUE",
          value: 16,
          min: 0,
          precision: 1
        },
        {
          type: "field_dropdown",
          name: "UNIT",
          options: CSS_UNIT_OPTIONS
        }
      ],
      tooltip: BLOCK_TOOLTIPS.css_size_declaration
    }),
    createCssDeclarationBlock({
      type: "css_text_align_declaration",
      label: "text align %1",
      args: [
        {
          type: "field_dropdown",
          name: "VALUE",
          options: CSS_TEXT_ALIGN_OPTIONS
        }
      ],
      tooltip: BLOCK_TOOLTIPS.css_text_align_declaration
    }),
    createCssDeclarationBlock({
      type: "css_font_family_declaration",
      label: "font family %1",
      args: [
        {
          type: "field_dropdown",
          name: "VALUE",
          options: CSS_FONT_FAMILY_OPTIONS
        }
      ],
      tooltip: BLOCK_TOOLTIPS.css_font_family_declaration
    }),
    createCssDeclarationBlock({
      type: "css_font_weight_declaration",
      label: "font weight %1",
      args: [
        {
          type: "field_dropdown",
          name: "VALUE",
          options: CSS_FONT_WEIGHT_OPTIONS
        }
      ],
      tooltip: BLOCK_TOOLTIPS.css_font_weight_declaration
    }),
    createCssDeclarationBlock({
      type: "css_display_declaration",
      label: "display %1",
      args: [
        {
          type: "field_dropdown",
          name: "VALUE",
          options: CSS_DISPLAY_OPTIONS
        }
      ],
      tooltip: BLOCK_TOOLTIPS.css_display_declaration
    }),
    createCssDeclarationBlock({
      type: "css_border_declaration",
      label: "border %1 %2 %3 %4",
      args: [
        {
          type: "field_number",
          name: "WIDTH",
          value: 2,
          min: 0,
          precision: 1
        },
        {
          type: "field_dropdown",
          name: "UNIT",
          options: CSS_UNIT_OPTIONS
        },
        {
          type: "field_dropdown",
          name: "STYLE",
          options: CSS_BORDER_STYLE_OPTIONS
        },
        {
          type: "field_dropdown",
          name: "COLOUR",
          options: CSS_COLOUR_OPTIONS
        }
      ],
      tooltip: BLOCK_TOOLTIPS.css_border_declaration
    }),
    createCssDeclarationBlock({
      type: "css_custom_declaration",
      label: "custom %1 value %2",
      args: [
        {type: "field_input", name: "PROPERTY", text: "text-transform"},
        {type: "field_input", name: "VALUE", text: "uppercase"}
      ],
      tooltip: BLOCK_TOOLTIPS.css_custom_declaration
    })
  ];

  if (Blockly.common && Blockly.common.defineBlocksWithJsonArray) {
    Blockly.common.defineBlocksWithJsonArray(blockDefinitions);
    return;
  }

  Blockly.defineBlocksWithJsonArray(blockDefinitions);
}

function createToolbox() {
  return {
    kind: "categoryToolbox",
    contents: [
      {
        kind: "category",
        name: "Document",
        categorystyle: "document_category",
        contents: [
          {kind: "block", type: "html_document"},
          {kind: "block", type: "html_comment"}
        ]
      },
      {
        kind: "category",
        name: "Text",
        categorystyle: "text_category",
        contents: [
          {kind: "block", type: "html_heading1"},
          {kind: "block", type: "html_heading2"},
          {kind: "block", type: "html_heading3"},
          {kind: "block", type: "html_paragraph"}
        ]
      },
      {
        kind: "category",
        name: "Structure",
        categorystyle: "structure_category",
        contents: [
          {kind: "block", type: "html_header"},
          {kind: "block", type: "html_nav"},
          {kind: "block", type: "html_main"},
          {kind: "block", type: "html_section"},
          {kind: "block", type: "html_article"},
          {kind: "block", type: "html_div"},
          {kind: "block", type: "html_footer"}
        ]
      },
      {
        kind: "category",
        name: "Graphics",
        categorystyle: "media_category",
        contents: [
          {kind: "block", type: "html_link"},
          {kind: "block", type: "html_image"},
          {kind: "block", type: "html_figure"},
          {kind: "block", type: "html_figcaption"},
          {kind: "block", type: "html_picture"},
          {kind: "block", type: "html_picture_source"},
          {kind: "block", type: "html_picture_image"},
          {kind: "block", type: "html_svg"},
          {kind: "block", type: "svg_rect"},
          {kind: "block", type: "svg_circle"},
          {kind: "block", type: "svg_text"}
        ]
      },
      {
        kind: "category",
        name: "Media",
        categorystyle: "media_category",
        contents: [
          {kind: "block", type: "html_audio"},
          {kind: "block", type: "html_video"},
          {kind: "block", type: "html_media_source"}
        ]
      },
      {
        kind: "category",
        name: "Lists",
        categorystyle: "lists_category",
        contents: [
          {kind: "block", type: "html_ul"},
          {kind: "block", type: "html_ol"},
          {kind: "block", type: "html_li"}
        ]
      },
      {
        kind: "category",
        name: "Tables",
        categorystyle: "tables_category",
        contents: [
          {kind: "block", type: "html_table"},
          {kind: "block", type: "html_tr"},
          {kind: "block", type: "html_th"},
          {kind: "block", type: "html_td"}
        ]
      },
      {
        kind: "category",
        name: "Forms",
        categorystyle: "forms_category",
        contents: [
          {kind: "block", type: "html_form"},
          {kind: "block", type: "html_label"},
          {kind: "block", type: "html_input"},
          {kind: "block", type: "html_button"}
        ]
      },
      {
        kind: "sep",
        cssConfig: {
          container: "toolbox-section-gap"
        }
      },
      {
        kind: "category",
        name: "CSS Rules",
        categorystyle: "css_category",
        contents: [
          {kind: "block", type: "css_rule_tag"},
          {kind: "block", type: "css_rule_class"},
          {kind: "block", type: "css_rule_id"}
        ]
      },
      {
        kind: "category",
        name: "CSS Properties",
        categorystyle: "css_category",
        contents: [
          {kind: "block", type: "css_colour_declaration"},
          {kind: "block", type: "css_size_declaration"},
          {kind: "block", type: "css_text_align_declaration"},
          {kind: "block", type: "css_font_family_declaration"},
          {kind: "block", type: "css_font_weight_declaration"},
          {kind: "block", type: "css_display_declaration"},
          {kind: "block", type: "css_border_declaration"},
          {kind: "block", type: "css_custom_declaration"}
        ]
      }
    ]
  };
}

function createHtmlGenerator() {
  const generator = new Blockly.Generator("HTML");
  generator.INDENT = "  ";
  generator.PASS = "";

  generator.init = function() {};
  generator.finish = function(code) {
    return code;
  };
  generator.scrubNakedValue = function(line) {
    return line;
  };
  generator.scrub_ = function(block, code, thisOnly) {
    const nextBlock = block.nextConnection && block.nextConnection.targetBlock();
    const nextCode = !thisOnly && nextBlock ? generator.blockToCode(nextBlock) : "";
    return code + nextCode;
  };

  function buildAttributeString(block, attributeSpecs) {
    const attributes = [];

    attributeSpecs.forEach((spec) => {
      if (spec.type === "boolean") {
        if (String(block.getFieldValue(spec.field)) === "TRUE") {
          attributes.push(spec.attribute);
        }
        return;
      }

      const value = getFieldValue(block, spec.field);
      if (!value) {
        return;
      }

      if (typeof spec.omitIf === "function" && spec.omitIf(value)) {
        return;
      }

      attributes.push(`${spec.attribute}="${escapeAttribute(value)}"`);
    });

    return attributes.length > 0 ? ` ${attributes.join(" ")}` : "";
  }

  function buildCombinedAttributeString(block, extraSpecs = []) {
    return buildAttributeString(block, [...extraSpecs, ...GLOBAL_ATTRIBUTE_SPECS]);
  }

  function renderWrappedElement(tagName, block, inputName, innerGenerator, extraSpecs = []) {
    const attributes = buildCombinedAttributeString(block, extraSpecs);
    const body = innerGenerator.statementToCode(block, inputName);
    return `<${tagName}${attributes}>\n${body}</${tagName}>\n`;
  }

  function renderTextElement(tagName, block, fieldName = "TEXT", extraSpecs = []) {
    const attributes = buildCombinedAttributeString(block, extraSpecs);
    const text = escapeHtmlText(getFieldValue(block, fieldName));
    return `<${tagName}${attributes}>${text}</${tagName}>\n`;
  }

  function renderCssRule(selector, declarations) {
    const safeSelector = sanitizeCssValue(selector);
    const body = declarations || "";
    return `${safeSelector} {\n${body}}\n`;
  }

  function renderCssDeclaration(property, value) {
    return `${sanitizeCssValue(property)}: ${sanitizeCssValue(value)};\n`;
  }

  generator.forBlock.html_document = function(block, innerGenerator) {
    const title = escapeHtmlText(getFieldValue(block, "TITLE"));
    const lang = escapeAttribute(getFieldValue(block, "LANG") || "en");
    const styles = innerGenerator.statementToCode(block, "STYLES").trimEnd();
    const body = innerGenerator.statementToCode(block, "BODY");
    const htmlAttributes = buildAttributeString(block, DOCUMENT_ROOT_ATTRIBUTE_SPECS);
    const headLines = [
      "<head>",
      "  <meta charset=\"UTF-8\">",
      "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
      `  <title>${title}</title>`
    ];

    if (styles) {
      headLines.push("  <style>");
      headLines.push(styles);
      headLines.push("  </style>");
    }

    headLines.push("</head>");

    return [
      "<!DOCTYPE html>",
      `<html lang="${lang}"${htmlAttributes}>`,
      ...headLines,
      "<body>",
      `${body}</body>`,
      "</html>",
      ""
    ].join("\n");
  };

  generator.forBlock.html_comment = function(block) {
    return `<!-- ${escapeComment(getFieldValue(block, "TEXT"))} -->\n`;
  };

  generator.forBlock.html_heading1 = function(block) {
    return renderTextElement("h1", block);
  };

  generator.forBlock.html_heading2 = function(block) {
    return renderTextElement("h2", block);
  };

  generator.forBlock.html_heading3 = function(block) {
    return renderTextElement("h3", block);
  };

  generator.forBlock.html_paragraph = function(block) {
    return renderTextElement("p", block);
  };

  generator.forBlock.html_link = function(block) {
    const text = escapeHtmlText(getFieldValue(block, "TEXT"));
    const href = escapeAttribute(getFieldValue(block, "HREF"));
    const attributes = buildAttributeString(block, [...LINK_ATTRIBUTE_SPECS, ...GLOBAL_ATTRIBUTE_SPECS]);
    return `<a href="${href}"${attributes}>${text}</a>\n`;
  };

  generator.forBlock.html_image = function(block) {
    const src = escapeAttribute(getFieldValue(block, "SRC"));
    const alt = escapeAttribute(getFieldValue(block, "ALT"));
    const attributes = buildAttributeString(block, [...IMAGE_ATTRIBUTE_SPECS, ...GLOBAL_ATTRIBUTE_SPECS]);
    return `<img src="${src}" alt="${alt}"${attributes}>\n`;
  };

  generator.forBlock.html_figure = function(block, innerGenerator) {
    return renderWrappedElement("figure", block, "CONTENT", innerGenerator);
  };

  generator.forBlock.html_figcaption = function(block) {
    return renderTextElement("figcaption", block);
  };

  generator.forBlock.html_picture = function(block, innerGenerator) {
    return renderWrappedElement("picture", block, "SOURCES", innerGenerator);
  };

  generator.forBlock.html_picture_source = function(block) {
    const srcset = getFieldValue(block, "SRCSET");
    const media = getFieldValue(block, "MEDIA");
    const type = getFieldValue(block, "TYPE");
    const optionalAttributes = [];

    if (media) {
      optionalAttributes.push(`media="${escapeAttribute(media)}"`);
    }

    if (type) {
      optionalAttributes.push(`type="${escapeAttribute(type)}"`);
    }

    return `<source srcset="${escapeAttribute(srcset)}"${optionalAttributes.length ? ` ${optionalAttributes.join(" ")}` : ""}>\n`;
  };

  generator.forBlock.html_picture_image = function(block) {
    const src = escapeAttribute(getFieldValue(block, "SRC"));
    const alt = escapeAttribute(getFieldValue(block, "ALT"));
    const attributes = buildAttributeString(block, [...IMAGE_ATTRIBUTE_SPECS, ...GLOBAL_ATTRIBUTE_SPECS]);
    return `<img src="${src}" alt="${alt}"${attributes}>\n`;
  };

  generator.forBlock.html_audio = function(block, innerGenerator) {
    const body = innerGenerator.statementToCode(block, "SOURCES");
    const attributes = buildAttributeString(block, [...AUDIO_ATTRIBUTE_SPECS, ...GLOBAL_ATTRIBUTE_SPECS]);
    return `<audio${attributes}>\n${body}</audio>\n`;
  };

  generator.forBlock.html_video = function(block, innerGenerator) {
    const body = innerGenerator.statementToCode(block, "SOURCES");
    const attributes = buildAttributeString(block, [...VIDEO_ATTRIBUTE_SPECS, ...GLOBAL_ATTRIBUTE_SPECS]);
    return `<video${attributes}>\n${body}</video>\n`;
  };

  generator.forBlock.html_media_source = function(block) {
    const src = getFieldValue(block, "SRC");
    const type = getFieldValue(block, "TYPE");
    const typeAttribute = type ? ` type="${escapeAttribute(type)}"` : "";
    return `<source src="${escapeAttribute(src)}"${typeAttribute}>\n`;
  };

  generator.forBlock.html_svg = function(block, innerGenerator) {
    const width = escapeAttribute(getFieldValue(block, "WIDTH"));
    const height = escapeAttribute(getFieldValue(block, "HEIGHT"));
    const attributes = buildAttributeString(block, GLOBAL_ATTRIBUTE_SPECS);
    const shapes = innerGenerator.statementToCode(block, "SHAPES");
    return `<svg width="${width}" height="${height}"${attributes}>\n${shapes}</svg>\n`;
  };

  generator.forBlock.svg_rect = function(block) {
    const x = escapeAttribute(getFieldValue(block, "X"));
    const y = escapeAttribute(getFieldValue(block, "Y"));
    const width = escapeAttribute(getFieldValue(block, "WIDTH"));
    const height = escapeAttribute(getFieldValue(block, "HEIGHT"));
    const fill = escapeAttribute(getFieldValue(block, "FILL"));
    const stroke = escapeAttribute(getFieldValue(block, "STROKE"));
    return `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" stroke="${stroke}"></rect>\n`;
  };

  generator.forBlock.svg_circle = function(block) {
    const cx = escapeAttribute(getFieldValue(block, "CX"));
    const cy = escapeAttribute(getFieldValue(block, "CY"));
    const r = escapeAttribute(getFieldValue(block, "R"));
    const fill = escapeAttribute(getFieldValue(block, "FILL"));
    const stroke = escapeAttribute(getFieldValue(block, "STROKE"));
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}"></circle>\n`;
  };

  generator.forBlock.svg_text = function(block) {
    const text = escapeHtmlText(getFieldValue(block, "TEXT"));
    const x = escapeAttribute(getFieldValue(block, "X"));
    const y = escapeAttribute(getFieldValue(block, "Y"));
    const size = escapeAttribute(getFieldValue(block, "SIZE"));
    const fill = escapeAttribute(getFieldValue(block, "FILL"));
    return `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}">${text}</text>\n`;
  };

  generator.forBlock.html_header = function(block, innerGenerator) {
    return renderWrappedElement("header", block, "CONTENT", innerGenerator);
  };

  generator.forBlock.html_nav = function(block, innerGenerator) {
    return renderWrappedElement("nav", block, "CONTENT", innerGenerator);
  };

  generator.forBlock.html_main = function(block, innerGenerator) {
    return renderWrappedElement("main", block, "CONTENT", innerGenerator);
  };

  generator.forBlock.html_section = function(block, innerGenerator) {
    return renderWrappedElement("section", block, "CONTENT", innerGenerator);
  };

  generator.forBlock.html_article = function(block, innerGenerator) {
    return renderWrappedElement("article", block, "CONTENT", innerGenerator);
  };

  generator.forBlock.html_div = function(block, innerGenerator) {
    return renderWrappedElement("div", block, "CONTENT", innerGenerator);
  };

  generator.forBlock.html_footer = function(block, innerGenerator) {
    return renderWrappedElement("footer", block, "CONTENT", innerGenerator);
  };

  generator.forBlock.html_ul = function(block, innerGenerator) {
    return renderWrappedElement("ul", block, "ITEMS", innerGenerator);
  };

  generator.forBlock.html_ol = function(block, innerGenerator) {
    return renderWrappedElement("ol", block, "ITEMS", innerGenerator, ORDERED_LIST_ATTRIBUTE_SPECS);
  };

  generator.forBlock.html_li = function(block) {
    return renderTextElement("li", block);
  };

  generator.forBlock.html_table = function(block, innerGenerator) {
    return renderWrappedElement("table", block, "ROWS", innerGenerator);
  };

  generator.forBlock.html_tr = function(block, innerGenerator) {
    return renderWrappedElement("tr", block, "CELLS", innerGenerator);
  };

  generator.forBlock.html_th = function(block) {
    return renderTextElement("th", block, "TEXT", HEADER_CELL_ATTRIBUTE_SPECS);
  };

  generator.forBlock.html_td = function(block) {
    return renderTextElement("td", block, "TEXT", DATA_CELL_ATTRIBUTE_SPECS);
  };

  generator.forBlock.html_form = function(block, innerGenerator) {
    const action = escapeAttribute(getFieldValue(block, "ACTION"));
    const method = escapeAttribute(getFieldValue(block, "METHOD"));
    const body = innerGenerator.statementToCode(block, "CONTROLS");
    const attributes = buildAttributeString(block, [...FORM_ATTRIBUTE_SPECS, ...GLOBAL_ATTRIBUTE_SPECS]);
    return `<form action="${action}" method="${method}"${attributes}>\n${body}</form>\n`;
  };

  generator.forBlock.html_label = function(block) {
    const text = escapeHtmlText(getFieldValue(block, "TEXT"));
    const forValue = escapeAttribute(getFieldValue(block, "FOR"));
    const attributes = buildCombinedAttributeString(block);
    return `<label for="${forValue}"${attributes}>${text}</label>\n`;
  };

  generator.forBlock.html_input = function(block) {
    const type = escapeAttribute(getFieldValue(block, "TYPE"));
    const name = escapeAttribute(getFieldValue(block, "NAME"));
    const placeholder = escapeAttribute(getFieldValue(block, "PLACEHOLDER"));
    const attributes = buildAttributeString(block, [...INPUT_ATTRIBUTE_SPECS, ...GLOBAL_ATTRIBUTE_SPECS]);
    return `<input type="${type}" name="${name}" placeholder="${placeholder}"${attributes}>\n`;
  };

  generator.forBlock.html_button = function(block) {
    const text = escapeHtmlText(getFieldValue(block, "TEXT"));
    const type = escapeAttribute(getFieldValue(block, "TYPE"));
    const attributes = buildAttributeString(block, [...BUTTON_ATTRIBUTE_SPECS, ...GLOBAL_ATTRIBUTE_SPECS]);
    return `<button type="${type}"${attributes}>${text}</button>\n`;
  };

  generator.forBlock.css_rule_tag = function(block, innerGenerator) {
    const selector = getFieldValue(block, "SELECTOR");
    const declarations = innerGenerator.statementToCode(block, "DECLARATIONS");
    return renderCssRule(selector, declarations);
  };

  generator.forBlock.css_rule_class = function(block, innerGenerator) {
    const selector = sanitizeCssIdentifier(getFieldValue(block, "SELECTOR"));
    const declarations = innerGenerator.statementToCode(block, "DECLARATIONS");
    return renderCssRule(`.${selector}`, declarations);
  };

  generator.forBlock.css_rule_id = function(block, innerGenerator) {
    const selector = sanitizeCssIdentifier(getFieldValue(block, "SELECTOR"));
    const declarations = innerGenerator.statementToCode(block, "DECLARATIONS");
    return renderCssRule(`#${selector}`, declarations);
  };

  generator.forBlock.css_colour_declaration = function(block) {
    return renderCssDeclaration(getFieldValue(block, "PROPERTY"), getFieldValue(block, "VALUE"));
  };

  generator.forBlock.css_size_declaration = function(block) {
    const property = getFieldValue(block, "PROPERTY");
    const value = `${getFieldValue(block, "VALUE")}${getFieldValue(block, "UNIT")}`;
    return renderCssDeclaration(property, value);
  };

  generator.forBlock.css_text_align_declaration = function(block) {
    return renderCssDeclaration("text-align", getFieldValue(block, "VALUE"));
  };

  generator.forBlock.css_font_family_declaration = function(block) {
    return renderCssDeclaration("font-family", getFieldValue(block, "VALUE"));
  };

  generator.forBlock.css_font_weight_declaration = function(block) {
    return renderCssDeclaration("font-weight", getFieldValue(block, "VALUE"));
  };

  generator.forBlock.css_display_declaration = function(block) {
    return renderCssDeclaration("display", getFieldValue(block, "VALUE"));
  };

  generator.forBlock.css_border_declaration = function(block) {
    const width = `${getFieldValue(block, "WIDTH")}${getFieldValue(block, "UNIT")}`;
    const value = `${width} ${getFieldValue(block, "STYLE")} ${getFieldValue(block, "COLOUR")}`;
    return renderCssDeclaration("border", value);
  };

  generator.forBlock.css_custom_declaration = function(block) {
    return renderCssDeclaration(getFieldValue(block, "PROPERTY"), getFieldValue(block, "VALUE"));
  };

  return generator;
}

const htmlGenerator = createHtmlGenerator();

function updateSaveStatus(message, tone = "neutral") {
  dom.saveStatus.textContent = message;
  dom.saveStatus.dataset.tone = tone;
}

function updateValidationBanner(message, tone) {
  dom.validationBanner.textContent = message;
  dom.validationBanner.dataset.tone = tone;
}

function countAllBlocks() {
  return workspace ? workspace.getAllBlocks(false).length : 0;
}

function getTopBlocks() {
  return workspace ? workspace.getTopBlocks(true) : [];
}

function getDocumentBlocks() {
  return getTopBlocks().filter((block) => block.type === "html_document");
}

function buildGeneratedCode() {
  const topBlocks = getTopBlocks();
  if (topBlocks.length === 0) {
    return EMPTY_CODE_MESSAGE;
  }

  return topBlocks
    .map((block) => htmlGenerator.blockToCode(block))
    .map((code) => String(code || "").trimEnd())
    .filter(Boolean)
    .join("\n");
}

function buildRenderDocument(code) {
  const trimmedCode = String(code || "").trim();
  if (!trimmedCode) {
    return EMPTY_RENDER_DOCUMENT;
  }

  if (/<!doctype html>/i.test(trimmedCode) || /<html[\s>]/i.test(trimmedCode)) {
    return trimmedCode;
  }

  return [
    "<!DOCTYPE html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"UTF-8\">",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">",
    "  <title>HTML Fragment Preview</title>",
    "</head>",
    "<body>",
    trimmedCode,
    "</body>",
    "</html>"
  ].join("\n");
}

function updateWorkspaceSummary() {
  const count = countAllBlocks();
  dom.workspaceSummary.textContent = `${count} block${count === 1 ? "" : "s"} in workspace`;
  dom.copyOutputBtn.disabled = count === 0;
  dom.clearWorkspaceBtn.disabled = count === 0;
}

function updateValidationState() {
  const documentCount = getDocumentBlocks().length;

  if (documentCount === 0) {
    updateValidationBanner("Add document", "warning");
    return;
  }

  if (documentCount > 1) {
    updateValidationBanner("One document only", "warning");
    return;
  }

  updateValidationBanner("Ready", "good");
}

function renderDerivedState() {
  const code = buildGeneratedCode();
  dom.outputPreview.textContent = code;
  dom.livePreviewFrame.srcdoc = buildRenderDocument(code === EMPTY_CODE_MESSAGE ? "" : code);
  updateWorkspaceSummary();
  updateValidationState();
}

function exportProject() {
  return {
    version: PROJECT_VERSION,
    format: PROJECT_FORMAT,
    workspace: Blockly.serialization.workspaces.save(workspace)
  };
}

function isValidProjectFile(payload) {
  return Boolean(
    payload &&
    typeof payload === "object" &&
    payload.version === PROJECT_VERSION &&
    payload.format === PROJECT_FORMAT &&
    payload.workspace &&
    typeof payload.workspace === "object"
  );
}

function resetStatusLater() {
  window.clearTimeout(statusResetTimer);
  statusResetTimer = window.setTimeout(() => {
    updateSaveStatus("Autosave ready");
  }, 1800);
}

function persistToLocalStorage(message = "Autosaved locally", tone = "good") {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(exportProject()));
    updateSaveStatus(message, tone);
  } catch (error) {
    updateSaveStatus("Local save failed", "warning");
  }
}

function scheduleAutosave() {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => {
    persistToLocalStorage("Autosaved locally", "good");
    resetStatusLater();
  }, 140);
}

function replaceWorkspaceState(serializedWorkspace) {
  isApplyingWorkspaceState = true;

  try {
    Blockly.Events.disable();
    workspace.clear();
    Blockly.serialization.workspaces.load(serializedWorkspace || {}, workspace);
    workspace.clearUndo();
  } finally {
    Blockly.Events.enable();
    isApplyingWorkspaceState = false;
  }

  renderDerivedState();
}

function sanitizeProjectFileName(rawName) {
  const safeName = String(rawName || "")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return safeName || "blockly-html-page";
}

function buildProjectFileName() {
  const documentBlock = getDocumentBlocks()[0];
  const title = documentBlock ? documentBlock.getFieldValue("TITLE") : "";
  return `${sanitizeProjectFileName(title)}.json`;
}

async function copyOutputToClipboard() {
  try {
    await navigator.clipboard.writeText(dom.outputPreview.textContent);
    updateSaveStatus("Copied HTML", "good");
  } catch (error) {
    updateSaveStatus("Copy failed", "warning");
  }

  resetStatusLater();
}

function saveProjectToFile() {
  persistToLocalStorage("Saved locally", "good");

  const blob = new Blob([JSON.stringify(exportProject(), null, 2)], {
    type: "application/json"
  });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = buildProjectFileName();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  updateSaveStatus("Saved file and local autosave", "good");
}

async function loadProjectFromFile(file) {
  try {
    const payload = JSON.parse(await file.text());
    if (!isValidProjectFile(payload)) {
      updateSaveStatus("Load failed: only blockly-html project files are supported", "warning");
      return;
    }

    replaceWorkspaceState(payload.workspace);
    persistToLocalStorage("Loaded project file", "good");
  } catch (error) {
    updateSaveStatus("Load failed", "warning");
  }
}

function restoreAutosave() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) {
      updateSaveStatus("Autosave ready");
      return false;
    }

    const payload = JSON.parse(saved);
    if (!isValidProjectFile(payload)) {
      updateSaveStatus("Autosave unavailable", "warning");
      return false;
    }

    replaceWorkspaceState(payload.workspace);
    updateSaveStatus("Restored local autosave", "good");
    resetStatusLater();
    return true;
  } catch (error) {
    updateSaveStatus("Autosave unavailable", "warning");
    return false;
  }
}

function handleWorkspaceChange(event) {
  if (isApplyingWorkspaceState || !event || event.isUiEvent) {
    return;
  }

  renderDerivedState();
  scheduleAutosave();
}

function injectWorkspace() {
  workspace = Blockly.inject(dom.blocklyHost, {
    toolbox: createToolbox(),
    theme: defineBlocklyTheme(),
    media: "./vendor/blockly/media/",
    trashcan: true,
    sounds: false,
    move: {
      scrollbars: true,
      drag: true,
      wheel: true
    },
    zoom: {
      controls: true,
      wheel: true,
      startScale: 0.95,
      maxScale: 1.5,
      minScale: 0.55,
      scaleSpeed: 1.1
    },
    grid: {
      spacing: 24,
      length: 3,
      colour: "#d6dff0",
      snap: false
    }
  });

  workspace.addChangeListener(handleWorkspaceChange);

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => queueWorkspaceResize());
    observer.observe(dom.blocklyHost);
  }

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 1240px)").matches) {
      applyPreviewWidth(getCurrentPreviewWidth(), {persist: false});
    }
    updatePanelResizerAria();
    queueWorkspaceResize();
  });
}

function wireUi() {
  dom.copyOutputBtn.addEventListener("click", () => {
    copyOutputToClipboard();
  });

  dom.saveProjectBtn.addEventListener("click", () => {
    saveProjectToFile();
  });

  dom.loadProjectBtn.addEventListener("click", () => {
    dom.loadProjectInput.click();
  });

  dom.loadProjectInput.addEventListener("change", async (event) => {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    await loadProjectFromFile(file);
    event.target.value = "";
  });

  dom.clearWorkspaceBtn.addEventListener("click", () => {
    if (!workspace || countAllBlocks() === 0) {
      return;
    }

    if (!window.confirm("Clear the entire workspace?")) {
      return;
    }

    replaceWorkspaceState({});
    persistToLocalStorage("Cleared workspace", "good");
  });

  if (dom.panelResizer) {
    dom.panelResizer.addEventListener("pointerdown", beginPanelResize);
    dom.panelResizer.addEventListener("pointermove", updatePanelResize);
    dom.panelResizer.addEventListener("pointerup", finishPanelResize);
    dom.panelResizer.addEventListener("pointercancel", cancelPanelResize);
    dom.panelResizer.addEventListener("keydown", handlePanelResizerKeydown);
  }
}

function initializeApp() {
  restorePreviewWidth();
  defineCustomBlocks();
  injectWorkspace();
  wireUi();
  renderDerivedState();

  const restoredAutosave = restoreAutosave();
  if (!restoredAutosave) {
    renderDerivedState();
  }
}

initializeApp();
