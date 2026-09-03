(() => {
  "use strict";

  const STORAGE_KEY = "agent-loom-project-v1";
  const DETAILS_WIDTH_KEY = "agent-loom-details-width";
  const NODE_WIDTH = 222;
  const STAGE = { width: 2300, height: 1200 };
  const kindInfo = {
    goal: { label: "Goal", color: "#36745e", title: "Define the goal", content: "State the specific outcome this agent must achieve and the conditions for success." },
    input: { label: "Input", color: "#7ea9c3", title: "Receive the request", content: "Collect the user's goal, source material, and any constraints." },
    plan: { label: "Plan", color: "#607f96", title: "Plan the approach", content: "Describe the ordered approach the agent should take before executing the task." },
    instruction: { label: "Instruction", color: "#8ca343", title: "Understand the task", content: "Clarify the objective and identify the outcome the user needs." },
    decision: { label: "Decision", color: "#f08b70", title: "Enough context?", content: "Decide whether there is enough information to complete the task confidently." },
    tool: { label: "Tool", color: "#9a8cc4", title: "Gather evidence", content: "Use the most relevant available tool to retrieve or verify information." },
    resource: { label: "Resource", color: "#e4b865", title: "Reference website", content: "Use this website as a preferred source when completing the connected step." },
    output: { label: "Output", color: "#205c49", title: "Deliver the result", content: "Provide a clear, complete response in the format the user requested." }
  };

  function makeNode(kind, x, y, title, content) {
    return { id: `n_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`, kind, x, y, title: title || kindInfo[kind].title, content: content || kindInfo[kind].content, url: "", yesLabel: "True", noLabel: "False" };
  }

  function makeEdge(from, to, branch = "") {
    const label = branch === "true" ? from.yesLabel : branch === "false" ? from.noLabel : "";
    return { from: from.id, to: to.id, label, branch };
  }

  function markingExample() {
    const goal = makeNode("goal", 410, 25, "Produce a reporting-ready comment", "Assess the submitted work fairly against the supplied rubric and produce one accurate, constructive student comment of 100–150 words.");
    const rubric = makeNode("input", 90, 100, "Receive the rubric", "Use the complete rubric, achievement criteria, reporting conventions, and expected year level.");
    const work = makeNode("input", 90, 390, "Receive the student work", "Use the student's complete submission and any relevant task context. Do not infer evidence that is not present.");
    const assess = makeNode("instruction", 410, 245, "Assess against the rubric", "Match specific evidence from the work to each rubric criterion. Identify demonstrated strengths, achievement level, and the most useful area for improvement.");
    const compose = makeNode("instruction", 745, 245, "Draft the report comment", "Write directly about the student's demonstrated learning. Use supportive, professional language and include a specific strength plus one achievable next step.");
    const check = makeNode("decision", 1080, 245, "Is the comment ready?", "Confirm the comment is evidence-based, aligned with the rubric, suitable for reporting, and between 100 and 150 words.");
    check.yesLabel = "Meets all requirements";
    check.noLabel = "Needs revision";
    const output = makeNode("output", 1430, 100, "Return the student comment", "Return only the polished student reporting comment. It must be between 100 and 150 words long.");
    const revise = makeNode("instruction", 1430, 410, "Revise the comment", "Correct unsupported claims, improve specificity and tone, and tighten or expand the comment until it contains 100–150 words.");
    return {
      name: "Rubric marking assistant",
      nodes: [goal, rubric, work, assess, compose, check, output, revise],
      edges: [makeEdge(goal, assess), makeEdge(rubric, assess), makeEdge(work, assess), makeEdge(assess, compose), makeEdge(compose, check), makeEdge(check, output, "true"), makeEdge(check, revise, "false"), makeEdge(revise, check)]
    };
  }

  function tutorialExample() {
    const goal = makeNode("goal", 70, 500, "Create effective tutorial notes", "Produce accurate, well-structured tutorial notes that achieve the learning goals and pass every self-assessment criterion.");
    const topic = makeNode("input", 70, 270, "Receive the tutorial topic", "Collect the topic, learner level, learning goals, desired depth, length, and any required curriculum or assessment context.");
    const plan = makeNode("plan", 365, 270, "Plan the learning sequence", "Break the topic into prerequisite knowledge, core concepts, worked examples, practice prompts, and a logical teaching sequence.");
    const sources = makeNode("resource", 365, 50, "Preferred research sources", "Use teacher-approved, primary, or authoritative sources relevant to the topic. Add a specific website URL when one is required.");
    const research = makeNode("tool", 680, 270, "Research and verify", "Research the planned concepts, cross-check important claims, gather examples, and retain useful source links for the notes.");
    const draft = makeNode("instruction", 995, 270, "Draft the tutorial notes", "Create structured teaching notes with clear explanations, definitions, examples, checks for understanding, and a concise summary.");
    const review = makeNode("instruction", 1310, 270, "Self-assess the notes", "Assess accuracy, completeness, clarity, sequencing, examples, learner suitability, and source support. Identify every remaining weakness before deciding.");
    const decision = makeNode("decision", 1605, 270, "Are the notes good enough?", "Choose True only when every self-assessment category is satisfactory and no material gap remains. Otherwise choose False.");
    decision.yesLabel = "Good enough";
    decision.noLabel = "Continue improving";
    const output = makeNode("output", 1950, 80, "Deliver tutorial notes", "Return the finished tutorial notes with headings, explanations, examples, practice prompts, summary, and source links where applicable.");
    const improve = makeNode("instruction", 1950, 455, "Identify gaps and improve", "Turn each self-assessment weakness into a focused research question, then continue research and revise the notes before assessing them again.");
    return {
      name: "Tutorial notes generator",
      nodes: [goal, topic, plan, sources, research, draft, review, decision, output, improve],
      edges: [makeEdge(goal, plan), makeEdge(topic, plan), makeEdge(plan, research), makeEdge(sources, research), makeEdge(research, draft), makeEdge(draft, review), makeEdge(review, decision), makeEdge(decision, output, "true"), makeEdge(decision, improve, "false"), makeEdge(improve, research)]
    };
  }

  const exampleBuilders = { marking: markingExample, tutorial: tutorialExample };

  let state = loadState() || markingExample();
  let selectedId = state.nodes[0]?.id || null;
  let connectingFrom = null;
  let connectingBranch = "";
  let zoom = 1;
  let pan = { x: -40, y: -90 };
  let drag = null;
  let panDrag = null;
  let detailsResize = null;
  let detailsWidth = 340;
  let saveTimer;

  const $ = (selector) => document.querySelector(selector);
  const nodesLayer = $("#nodes-layer");
  const svg = $("#connections");
  const viewport = $("#canvas-viewport");
  const stage = $("#canvas-stage");
  const detailsResizer = $("#details-resizer");

  function loadState() {
    try {
      return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY)));
    } catch { return null; }
  }

  function normalizeState(value) {
    if (!value || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) return null;
    const validKinds = Object.keys(kindInfo);
    const nodes = value.nodes.slice(0, 100).filter(node => node && validKinds.includes(node.kind) && /^[A-Za-z0-9_-]{1,80}$/.test(node.id)).map(node => ({
      id: node.id,
      kind: node.kind,
      x: Math.max(0, Math.min(STAGE.width - NODE_WIDTH, Number.isFinite(Number(node.x)) ? Number(node.x) : 100)),
      y: Math.max(0, Math.min(STAGE.height - 110, Number.isFinite(Number(node.y)) ? Number(node.y) : 100)),
      title: String(node.title || kindInfo[node.kind].title).slice(0, 70),
      content: String(node.content || kindInfo[node.kind].content).slice(0, 1600),
      url: String(node.url || "").slice(0, 500),
      yesLabel: String(node.yesLabel || "True").slice(0, 32),
      noLabel: String(node.noLabel || "False").slice(0, 32)
    }));
    const ids = new Set(nodes.map(node => node.id));
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const edges = value.edges.slice(0, 200).filter(edge => edge && ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to).map(edge => {
      const source = nodeMap.get(edge.from);
      let branch = "";
      if (source?.kind === "decision") {
        const legacyFalse = String(edge.label || "").toLowerCase() === String(source.noLabel || "False").toLowerCase() || /^(no|false)$/.test(String(edge.label || "").toLowerCase());
        branch = edge.branch === "false" || (edge.branch !== "true" && legacyFalse) ? "false" : "true";
      }
      const defaultLabel = branch === "true" ? source.yesLabel : branch === "false" ? source.noLabel : "";
      return { from: edge.from, to: edge.to, label: String(edge.label || defaultLabel).slice(0, 32), branch };
    });
    return { name: String(value.name || "Untitled agent").slice(0, 80), nodes, edges };
  }

  function save() {
    clearTimeout(saveTimer);
    $("#save-state").textContent = "Saving…";
    saveTimer = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      $("#save-state").textContent = "Saved locally";
    }, 180);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[c]);
  }

  function render() {
    $("#agent-name").value = state.name;
    nodesLayer.innerHTML = state.nodes.map((node, index) => {
      const info = kindInfo[node.kind] || kindInfo.instruction;
      const outputPorts = node.kind === "decision"
        ? `<button class="port port-out port-true ${node.id === connectingFrom && connectingBranch === "true" ? "active-port" : ""}" data-port="out" data-branch="true" title="${escapeHtml(node.yesLabel)} path" aria-label="Connect ${escapeHtml(node.yesLabel)} path from ${escapeHtml(node.title)}" type="button">T</button><button class="port port-out port-false ${node.id === connectingFrom && connectingBranch === "false" ? "active-port" : ""}" data-port="out" data-branch="false" title="${escapeHtml(node.noLabel)} path" aria-label="Connect ${escapeHtml(node.noLabel)} path from ${escapeHtml(node.title)}" type="button">F</button>`
        : `<button class="port port-out ${node.id === connectingFrom ? "active-port" : ""}" data-port="out" aria-label="Connect from ${escapeHtml(node.title)}" type="button"></button>`;
      return `<article class="flow-node ${node.id === selectedId ? "selected" : ""} ${node.id === connectingFrom ? "connecting" : ""}" data-id="${node.id}" data-kind="${node.kind}" style="left:${node.x}px;top:${node.y}px" tabindex="0" aria-label="${escapeHtml(info.label)} block: ${escapeHtml(node.title)}">
        <div class="node-accent"></div>
        <button class="port port-in" data-port="in" aria-label="Connect into ${escapeHtml(node.title)}" type="button"></button>
        <div class="node-body">
          <div class="node-meta"><span class="node-type">${escapeHtml(info.label)}</span><span class="node-number">${String(index + 1).padStart(2, "0")}</span></div>
          <div class="node-title">${escapeHtml(node.title)}</div>
          <div class="node-description">${escapeHtml(node.kind === "resource" && node.url ? node.url : node.content)}</div>
        </div>
        ${outputPorts}
      </article>`;
    }).join("");
    drawEdges();
    updateEditor();
    updatePreview();
    updateStageTransform();
    $("#empty-state").hidden = state.nodes.length > 0;
    $("#connect-hint").hidden = !connectingFrom;
    $("#flow-summary").textContent = `${state.nodes.length} block${state.nodes.length === 1 ? "" : "s"} · ${state.edges.length} connection${state.edges.length === 1 ? "" : "s"}`;
  }

  function drawEdges() {
    svg.setAttribute("viewBox", `0 0 ${STAGE.width} ${STAGE.height}`);
    const marker = `<defs><marker id="arrow" viewBox="0 0 10 10" refX="9.5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8d9891" /></marker></defs>`;
    svg.innerHTML = marker + state.edges.map(edge => {
      const a = state.nodes.find(n => n.id === edge.from);
      const b = state.nodes.find(n => n.id === edge.to);
      if (!a || !b) return "";
      // Anchor at the vertical centre and just outside each visible port.
      const x1 = a.x + NODE_WIDTH + (a.kind === "decision" ? 12 : 9);
      const y1 = a.y + (a.kind === "decision" ? (edge.branch === "false" ? 78 : 39) : 53);
      const x2 = b.x - 11;
      const y2 = b.y + (b.kind === "decision" ? 58 : 53);
      const bend = Math.max(55, Math.abs(x2 - x1) * .48);
      const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
      const label = edge.label ? `<text class="edge-label" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 9}" text-anchor="middle">${escapeHtml(edge.label)}</text>` : "";
      const active = edge.from === selectedId || edge.to === selectedId ? "active" : "";
      return `<path class="edge ${active}" data-from="${edge.from}" data-to="${edge.to}" d="${path}" marker-end="url(#arrow)" />${label}`;
    }).join("");
  }

  function updateEditor() {
    const node = state.nodes.find(n => n.id === selectedId);
    $("#node-form").hidden = !node;
    $("#editor-empty").hidden = !!node;
    if (!node) return;
    const info = kindInfo[node.kind];
    $("#kind-chip").style.background = info.color;
    $("#kind-label").textContent = `${info.label} block`;
    $("#node-title").value = node.title;
    $("#node-content").value = node.content;
    $("#resource-fields").hidden = node.kind !== "resource";
    $("#resource-url").value = node.url || "";
    $("#node-content-label").textContent = node.kind === "resource" ? "Usage instructions" : "Instructions";
    $("#content-help").textContent = node.kind === "resource" ? "Explain when and why the agent should consult this website." : "Be specific about what should happen at this step.";
    $("#condition-fields").hidden = node.kind !== "decision";
    $("#yes-label").value = node.yesLabel || "True";
    $("#no-label").value = node.noLabel || "False";
  }

  function orderedNodes() {
    if (!state.nodes.length) return [];
    const incoming = new Map(state.nodes.map(n => [n.id, 0]));
    state.edges.forEach(e => incoming.has(e.to) && incoming.set(e.to, incoming.get(e.to) + 1));
    const queue = state.nodes.filter(n => incoming.get(n.id) === 0).sort((a,b) => a.x - b.x);
    const result = [];
    const seen = new Set();
    while (queue.length) {
      const node = queue.shift();
      if (seen.has(node.id)) continue;
      seen.add(node.id); result.push(node);
      state.edges.filter(e => e.from === node.id).forEach(e => {
        incoming.set(e.to, incoming.get(e.to) - 1);
        if (incoming.get(e.to) <= 0) {
          const next = state.nodes.find(n => n.id === e.to);
          if (next) queue.push(next);
        }
      });
    }
    state.nodes.filter(n => !seen.has(n.id)).sort((a,b) => a.x - b.x).forEach(n => result.push(n));
    return result;
  }

  function slug(value) {
    return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "agent";
  }

  function generateMarkdown() {
    const ordered = orderedNodes();
    const inputs = ordered.filter(n => n.kind === "input");
    const outputs = ordered.filter(n => n.kind === "output");
    const tools = ordered.filter(n => n.kind === "tool");
    const resources = ordered.filter(n => n.kind === "resource");
    const goals = ordered.filter(n => n.kind === "goal");
    const plans = ordered.filter(n => n.kind === "plan");
    const nodeById = new Map(state.nodes.map(node => [node.id, node]));
    const orderIndex = new Map(ordered.map((node, index) => [node.id, index]));
    const inlineText = value => String(value || "").replace(/\s+/g, " ").trim();
    let md = `---\nname: ${slug(state.name)}\ndescription: ${JSON.stringify(state.name)}\n---\n\n# ${state.name}\n\n`;
    md += `## Purpose\n\nFollow the workflow below to complete the user's request reliably.\n\n`;
    if (goals.length) md += `## Goal\n\n${goals.map(goal => `- **${goal.title}:** ${goal.content}`).join("\n")}\n\n`;
    if (inputs.length) md += `## Inputs\n\n${inputs.map(n => `- **${n.title}:** ${n.content}`).join("\n")}\n\n`;
    if (plans.length) md += `## Plan\n\n${plans.map((plan, index) => `${index + 1}. **${plan.title}:** ${plan.content}`).join("\n")}\n\n`;
    if (resources.length) md += `## Resources\n\n${resources.map(resource => {
      const usedBy = state.edges.filter(edge => edge.from === resource.id).map(edge => nodeById.get(edge.to)?.title).filter(Boolean);
      return `### ${resource.title}\n\nWebsite: ${resource.url || "Not specified"}\n\n${resource.content}\n\nUsed by: ${usedBy.length ? usedBy.join(", ") : "Not connected"}`;
    }).join("\n\n")}\n\n`;
    if (tools.length) md += `## Tools\n\n${tools.map(n => `- **${n.title}:** ${n.content}`).join("\n")}\n\n`;
    if (state.edges.length) {
      md += `## Flow map\n\nFollow every connection below. A labelled connection is a decision path. A loop returns execution to an earlier step.\n\n`;
      state.edges.forEach(edge => {
        const source = nodeById.get(edge.from);
        const target = nodeById.get(edge.to);
        if (!source || !target) return;
        const branch = edge.label ? ` —[${inlineText(edge.label)}]→ ` : " → ";
        const isLoop = orderIndex.get(edge.to) <= orderIndex.get(edge.from);
        md += `- ${inlineText(source.title)}${branch}${inlineText(target.title)}${isLoop ? " (loop)" : ""}\n`;
      });
      md += `\n`;
    }
    md += `## Workflow\n\n`;
    ordered.forEach((node, index) => {
      const incoming = state.edges.filter(edge => edge.to === node.id).map(edge => nodeById.get(edge.from)).filter(Boolean);
      const requiredResources = incoming.filter(source => source.kind === "resource");
      const outgoing = state.edges.filter(e => e.from === node.id).map(e => {
        const target = nodeById.get(e.to);
        return target ? { label: e.label, target: target.title } : null;
      }).filter(Boolean);
      md += `### ${index + 1}. ${node.title}\n\n${node.content}\n`;
      if (incoming.length) md += `\nReceives from: ${incoming.map(source => source.title).join(", ")}\n`;
      if (requiredResources.length) md += `\nRequired resources: ${requiredResources.map(resource => resource.title).join(", ")}\n`;
      if (node.kind === "decision" && outgoing.length) md += `\nBranches:\n${outgoing.map(path => `- ${path.label || "Continue"} → ${path.target}`).join("\n")}\n`;
      else if (outgoing.length) md += `\nNext: ${outgoing.map(path => path.target).join(", ")}\n`;
      md += `\n`;
    });
    if (outputs.length) md += `## Expected output\n\n${outputs.map(n => `- **${n.title}:** ${n.content}`).join("\n")}\n\n`;
    md += `## Operating rules\n\n- Follow the workflow in order unless a branch directs otherwise.\n- Preserve the user's constraints and requested format.\n- State uncertainty clearly; do not invent missing facts.\n\n`;
    return md;
  }

  function downloadFile(contents, filename, type) {
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function updatePreview() { $("#markdown-preview").textContent = generateMarkdown(); }

  function updateStageTransform() {
    stage.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
    $("#zoom-label").textContent = `${Math.round(zoom * 100)}%`;
  }

  function setDetailsWidth(width, persist = true) {
    const sidebarWidth = window.innerWidth <= 1000 ? 220 : 270;
    const maximum = Math.max(280, Math.min(700, window.innerWidth - sidebarWidth - 360));
    detailsWidth = Math.round(Math.max(280, Math.min(maximum, Number(width) || 340)));
    document.documentElement.style.setProperty("--details-width", `${detailsWidth}px`);
    detailsResizer.setAttribute("aria-valuemin", "280");
    detailsResizer.setAttribute("aria-valuemax", String(maximum));
    detailsResizer.setAttribute("aria-valuenow", String(detailsWidth));
    if (persist) localStorage.setItem(DETAILS_WIDTH_KEY, String(detailsWidth));
  }

  function mutateSelected(field, value) {
    const node = state.nodes.find(n => n.id === selectedId);
    if (!node) return;
    node[field] = value;
    if (node.kind === "decision" && (field === "yesLabel" || field === "noLabel")) {
      const branch = field === "yesLabel" ? "true" : "false";
      state.edges.filter(edge => edge.from === node.id && edge.branch === branch).forEach(edge => { edge.label = value; });
    }
    save(); render();
  }

  function addNode(kind) {
    const count = state.nodes.length;
    const viewX = (-pan.x + viewport.clientWidth * .45) / zoom;
    const viewY = (-pan.y + viewport.clientHeight * .45) / zoom;
    const node = makeNode(kind, Math.max(40, viewX + (count % 3) * 18), Math.max(70, viewY + (count % 3) * 22));
    state.nodes.push(node);
    selectedId = node.id;
    save(); render();
    showToast(`${kindInfo[kind].label} block added`);
  }

  function loadExample(key) {
    const build = exampleBuilders[key];
    if (!build) return;
    if (state.nodes.length && !confirm("Replace the current canvas with this example flow?")) return;
    state = build();
    selectedId = state.nodes[0]?.id || null;
    connectingFrom = null;
    connectingBranch = "";
    save(); render(); requestAnimationFrame(fitDiagram);
    showToast(`${state.name} loaded`);
  }

  function removeNode(id) {
    state.nodes = state.nodes.filter(n => n.id !== id);
    state.edges = state.edges.filter(e => e.from !== id && e.to !== id);
    selectedId = state.nodes[0]?.id || null;
    connectingFrom = null;
    connectingBranch = "";
    save(); render();
  }

  function connect(from, to, requestedBranch = "") {
    if (from === to) return showToast("A block cannot connect to itself");
    const source = state.nodes.find(n => n.id === from);
    const branch = source?.kind === "decision" ? (requestedBranch === "false" ? "false" : "true") : "";
    if (state.edges.some(e => e.from === from && e.to === to && e.branch === branch)) return showToast("That path is already connected");
    if (branch) state.edges = state.edges.filter(edge => !(edge.from === from && edge.branch === branch));
    const label = branch === "true" ? source.yesLabel : branch === "false" ? source.noLabel : "";
    state.edges.push({ from, to, label, branch });
    save(); showToast(branch ? `${label} path connected` : "Blocks connected");
  }

  function activatePort(id, direction, branch = "") {
    selectedId = id;
    if (direction === "out") {
      const samePort = connectingFrom === id && connectingBranch === branch;
      connectingFrom = samePort ? null : id;
      connectingBranch = samePort ? "" : branch;
    } else if (connectingFrom) {
      connect(connectingFrom, id, connectingBranch);
      connectingFrom = null;
      connectingBranch = "";
    }
    render();
  }

  function fitDiagram() {
    if (!state.nodes.length) { zoom = 1; pan = { x: 0, y: 0 }; return updateStageTransform(); }
    const minX = Math.min(...state.nodes.map(n => n.x));
    const maxX = Math.max(...state.nodes.map(n => n.x + NODE_WIDTH));
    const minY = Math.min(...state.nodes.map(n => n.y));
    const maxY = Math.max(...state.nodes.map(n => n.y + 100));
    zoom = Math.min(1, Math.max(.45, Math.min((viewport.clientWidth - 110) / (maxX - minX), (viewport.clientHeight - 130) / (maxY - minY))));
    pan.x = (viewport.clientWidth - (maxX - minX) * zoom) / 2 - minX * zoom;
    pan.y = (viewport.clientHeight - (maxY - minY) * zoom) / 2 - minY * zoom;
    updateStageTransform();
  }

  function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove("show"), 1800);
  }

  nodesLayer.addEventListener("pointerdown", event => {
    const nodeEl = event.target.closest(".flow-node");
    if (!nodeEl) return;
    const id = nodeEl.dataset.id;
    const port = event.target.closest(".port");
    selectedId = id;
    if (port) {
      event.stopPropagation();
      activatePort(id, port.dataset.port, port.dataset.branch || ""); return;
    }
    const node = state.nodes.find(n => n.id === id);
    drag = { id, startX: event.clientX, startY: event.clientY, nodeX: node.x, nodeY: node.y };
    nodeEl.setPointerCapture(event.pointerId);
    render();
  });
  nodesLayer.addEventListener("keydown", event => {
    if (!['Enter', ' '].includes(event.key)) return;
    const port = event.target.closest(".port");
    const nodeEl = event.target.closest(".flow-node");
    if (!nodeEl) return;
    event.preventDefault();
    if (port) activatePort(nodeEl.dataset.id, port.dataset.port, port.dataset.branch || "");
    else { selectedId = nodeEl.dataset.id; render(); }
  });

  window.addEventListener("pointermove", event => {
    if (detailsResize) {
      setDetailsWidth(detailsResize.startWidth + detailsResize.startX - event.clientX);
    } else if (drag) {
      const node = state.nodes.find(n => n.id === drag.id);
      node.x = Math.max(0, Math.min(STAGE.width - NODE_WIDTH, drag.nodeX + (event.clientX - drag.startX) / zoom));
      node.y = Math.max(0, Math.min(STAGE.height - 110, drag.nodeY + (event.clientY - drag.startY) / zoom));
      const el = nodesLayer.querySelector(`[data-id="${drag.id}"]`);
      if (el) { el.style.left = `${node.x}px`; el.style.top = `${node.y}px`; }
      drawEdges();
    } else if (panDrag) {
      pan.x = panDrag.panX + event.clientX - panDrag.startX;
      pan.y = panDrag.panY + event.clientY - panDrag.startY;
      updateStageTransform();
    }
  });

  window.addEventListener("pointerup", () => { if (drag) save(); drag = null; panDrag = null; detailsResize = null; viewport.classList.remove("panning"); document.body.classList.remove("resizing-panels"); });
  viewport.addEventListener("pointerdown", event => {
    if (event.target !== viewport && event.target !== stage && event.target !== nodesLayer && event.target !== svg) return;
    if (connectingFrom) { connectingFrom = null; connectingBranch = ""; render(); }
    panDrag = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    viewport.classList.add("panning");
  });
  viewport.addEventListener("wheel", event => {
    event.preventDefault();
    const oldZoom = zoom;
    zoom = Math.max(.4, Math.min(1.5, zoom * (event.deltaY > 0 ? .92 : 1.08)));
    const rect = viewport.getBoundingClientRect();
    const mx = event.clientX - rect.left, my = event.clientY - rect.top;
    pan.x = mx - (mx - pan.x) * (zoom / oldZoom);
    pan.y = my - (my - pan.y) * (zoom / oldZoom);
    updateStageTransform();
  }, { passive: false });
  svg.addEventListener("click", event => {
    const edge = event.target.closest(".edge");
    if (!edge) return;
    state.edges = state.edges.filter(item => !(item.from === edge.dataset.from && item.to === edge.dataset.to));
    save(); render(); showToast("Connection removed");
  });
  detailsResizer.addEventListener("pointerdown", event => {
    event.preventDefault();
    detailsResize = { startX: event.clientX, startWidth: detailsWidth };
    detailsResizer.setPointerCapture(event.pointerId);
    document.body.classList.add("resizing-panels");
  });
  detailsResizer.addEventListener("keydown", event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    setDetailsWidth(detailsWidth + (event.key === 'ArrowLeft' ? 24 : -24));
  });
  detailsResizer.addEventListener("dblclick", () => setDetailsWidth(340));

  $("#node-library").addEventListener("click", e => { const btn = e.target.closest("[data-kind]"); if (btn) addNode(btn.dataset.kind); });
  $("#example-library").addEventListener("click", e => { const btn = e.target.closest("[data-example]"); if (btn) loadExample(btn.dataset.example); });
  $("#node-title").addEventListener("input", e => mutateSelected("title", e.target.value));
  $("#node-content").addEventListener("input", e => mutateSelected("content", e.target.value));
  $("#resource-url").addEventListener("input", e => mutateSelected("url", e.target.value));
  $("#resource-url").addEventListener("blur", e => {
    const value = e.target.value.trim();
    if (value && !/^https?:\/\//i.test(value)) mutateSelected("url", `https://${value}`);
  });
  $("#yes-label").addEventListener("input", e => mutateSelected("yesLabel", e.target.value));
  $("#no-label").addEventListener("input", e => mutateSelected("noLabel", e.target.value));
  $("#agent-name").addEventListener("input", e => { state.name = e.target.value || "Untitled agent"; save(); updatePreview(); });
  $("#delete-node").addEventListener("click", () => selectedId && removeNode(selectedId));
  $("#zoom-in").addEventListener("click", () => { zoom = Math.min(1.5, zoom + .1); updateStageTransform(); });
  $("#zoom-out").addEventListener("click", () => { zoom = Math.max(.4, zoom - .1); updateStageTransform(); });
  $("#fit-btn").addEventListener("click", fitDiagram);
  $("#clear-btn").addEventListener("click", () => {
    if (!state.nodes.length || confirm("Clear every block and connection from this canvas?")) { state.nodes = []; state.edges = []; selectedId = null; connectingFrom = null; connectingBranch = ""; save(); render(); }
  });

  document.querySelectorAll(".tab").forEach(tab => tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => { t.classList.toggle("active", t === tab); t.setAttribute("aria-selected", t === tab ? "true" : "false"); });
    $("#edit-panel").hidden = tab.dataset.tab !== "edit";
    $("#preview-panel").hidden = tab.dataset.tab !== "preview";
    if (tab.dataset.tab === "preview") updatePreview();
  }));

  $("#copy-btn").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(generateMarkdown()); showToast("Markdown copied"); }
    catch { showToast("Copy is unavailable in this browser"); }
  });

  $("#export-btn").addEventListener("click", () => {
    downloadFile(generateMarkdown(), `${slug(state.name)}.md`, "text/markdown;charset=utf-8");
    showToast("Clean prompt downloaded");
  });
  $("#save-project-btn").addEventListener("click", () => {
    const projectFile = { format: "agent-loom-project", version: 1, savedAt: new Date().toISOString(), project: state };
    downloadFile(JSON.stringify(projectFile, null, 2), `${slug(state.name)}.agentloom`, "application/json;charset=utf-8");
    showToast("Editable project saved");
  });
  $("#open-project-btn").addEventListener("click", () => $("#open-project-file").click());
  $("#open-project-file").addEventListener("change", async event => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      let raw;
      try {
        const parsed = JSON.parse(text);
        raw = parsed?.format === "agent-loom-project" ? parsed.project : parsed;
      } catch {
        const legacy = text.match(/<!--\s*agent-loom:([A-Za-z0-9+/=]+)\s*-->/);
        if (!legacy) throw new Error("Choose an Agent Loom project file");
        raw = JSON.parse(decodeURIComponent(escape(atob(legacy[1]))));
      }
      const imported = normalizeState(raw);
      if (!imported) throw new Error("Invalid project data");
      state = imported; selectedId = state.nodes[0]?.id || null; connectingFrom = null; connectingBranch = ""; save(); render(); requestAnimationFrame(fitDiagram); showToast("Project opened");
    } catch (error) { showToast(error.message || "Could not open that project"); }
    event.target.value = "";
  });

  window.addEventListener("keydown", event => {
    if ((event.key === "Delete" || event.key === "Backspace") && selectedId && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) removeNode(selectedId);
    if (event.key === "Escape" && connectingFrom) { connectingFrom = null; connectingBranch = ""; render(); }
  });
  window.addEventListener("resize", () => { setDetailsWidth(detailsWidth, false); fitDiagram(); });

  setDetailsWidth(Number(localStorage.getItem(DETAILS_WIDTH_KEY)) || 340, false);
  render();
  requestAnimationFrame(fitDiagram);
})();
