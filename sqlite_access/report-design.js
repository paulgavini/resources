(() => {
  const maxLevels = 10;
  const sectionDefaults = { 'report-header': true, 'page-header': false, 'report-footer': true, 'page-footer': false };
  let queryColumnSignature = null;

  function rootTable() { return document.querySelector('#report-design-table').value; }
  function fieldsForDesign() {
    if (reportDesignSourceMode === 'query') {
      if (!lastQueryResultSet) return [];
      return lastQueryResultSet.columns.map((name, index) => {
        const values = lastQueryResultSet.values.map((row) => row[index]).filter((value) => value !== null && value !== '');
        return { token: reportFieldToken('$query', String(index)), table: '$query', name, label: name, index,
          type: '', numeric: values.length > 0 && values.every((value) => Number.isFinite(Number(value))) };
      });
    }
    const root = rootTable();
    if (!root) return [];
    const relationships = getRelationships();
    const tables = [root]; const visited = new Set(tables);
    for (let index = 0; index < tables.length; index += 1) {
      const current = tables[index];
      for (const relation of relationships) {
        const next = relation.childTable === current ? relation.targetTable : relation.targetTable === current ? relation.childTable : null;
        if (next && !visited.has(next)) { visited.add(next); tables.push(next); }
      }
    }
    return tables.flatMap((table) => getTableSchema(table).map((field) => ({
      token: reportFieldToken(table, field.name), table, name: field.name, label: `${table} · ${field.name}`,
      type: field.type, numeric: /INT|REAL|FLOA|DOUB|NUM|DEC/i.test(field.type),
    })));
  }

  function fieldReference(field) {
    return field.table === '$query' ? { index: field.index, name: field.name } : { table: field.table, name: field.name };
  }

  function findField(reference, fields) {
    if (!reference) return null;
    return fields.find((field) => reference.table
      ? field.table === reference.table && field.name === reference.name
      : field.table === '$query' && field.index === reference.index && field.name === reference.name)
      || fields.find((field) => field.name === reference.name) || null;
  }

  function feedback(message, isError = false, saved = false) {
    const element = document.querySelector(saved ? '#report-design-saved-feedback' : '#report-design-feedback');
    element.textContent = message; element.classList.toggle('is-error', isError);
  }

  function sections(fields) {
    const output = [];
    if (reportDesignSections['report-header']) output.push(['report-header', 'Report Header', 'Once, at the start of the report.']);
    if (reportDesignSections['page-header']) output.push(['page-header', 'Page Header', 'Repeated at the top of printed pages.']);
    const groups = reportDesignLevels.filter((item) => item.type === 'group');
    groups.forEach((level, index) => {
      const field = fields.find((item) => item.token === level.fieldToken);
      if (level.showHeader) output.push([`${level.id}:header`, `Group Header · ${index + 1}${field ? ` · ${field.name}` : ''}`, 'Before each group.']);
    });
    output.push(['detail', 'Detail', 'Repeated once for each source record.']);
    [...groups].reverse().forEach((level, index) => {
      const field = fields.find((item) => item.token === level.fieldToken);
      if (level.showFooter) output.push([`${level.id}:footer`, `Group Footer · ${groups.length - index}${field ? ` · ${field.name}` : ''}`, 'After each group.']);
    });
    if (reportDesignSections['report-footer']) output.push(['report-footer', 'Report Footer', 'Once, after the last record.']);
    if (reportDesignSections['page-footer']) output.push(['page-footer', 'Page Footer', 'Repeated at the bottom of printed pages.']);
    return output;
  }

  function renderFieldList(fields) {
    const host = document.querySelector('#report-design-fields'); host.replaceChildren();
    if (!fields.length) {
      const empty = document.createElement('div'); empty.className = 'report-design-empty';
      empty.textContent = reportDesignSourceMode === 'query' ? 'Run a SELECT query in SQL Editor to load fields.' : 'Choose a starting table with fields.';
      host.append(empty); return;
    }
    const byTable = new Map();
    fields.forEach((field) => { if (!byTable.has(field.table)) byTable.set(field.table, []); byTable.get(field.table).push(field); });
    for (const [table, tableFields] of byTable) {
      const group = document.createElement('details'); group.className = 'report-table-group'; group.open = true;
      const summary = document.createElement('summary'); summary.className = 'report-table-group-heading';
      const name = document.createElement('span'); name.textContent = table === '$query' ? 'SQL result' : table;
      const meta = document.createElement('span'); meta.className = 'report-table-group-meta'; meta.textContent = table === '$query' ? 'QUERY' : (table === rootTable() ? 'STARTING TABLE' : 'RELATED TABLE');
      summary.append(name, meta); group.append(summary);
      const list = document.createElement('div'); list.className = 'report-table-fields';
      for (const field of tableFields) {
        const item = document.createElement('div'); item.className = 'report-design-field-item'; item.draggable = true; item.dataset.reportDesignFieldToken = field.token;
        const label = document.createElement('span'); label.textContent = field.name; label.title = field.label;
        const target = document.querySelector('#report-design-field-section');
        const sectionKey = target.value || 'detail';
        const sectionLabel = [...target.options].find((option) => option.value === sectionKey)?.textContent || 'Detail';
        const add = document.createElement('button'); add.type = 'button'; add.className = 'text-button'; add.dataset.addReportDesignField = field.token; add.textContent = '+ Add';
        add.setAttribute('aria-label', `Add ${field.label} to ${sectionLabel} section`); add.title = `Add to ${sectionLabel}`; item.append(label, add); list.append(item);
      }
      group.append(list); host.append(group);
    }
  }

  function intervalOptions(field) {
    const options = [['NORMAL', 'Each value']];
    let samples = [];
    if (reportDesignSourceMode === 'query' && lastQueryResultSet && field) {
      samples = lastQueryResultSet.values.slice(0, 20).map((row) => row[field.index]);
    } else if (field && field.table !== '$query') {
      try {
        const column = quoteIdentifier(field.name); const table = quoteIdentifier(field.table);
        samples = (db.exec(`SELECT ${column} FROM ${table} WHERE ${column} IS NOT NULL AND TRIM(CAST(${column} AS TEXT)) <> '' LIMIT 20;`)[0]?.values || []).map(([value]) => value);
      } catch { samples = []; }
    }
    const hasIsoDate = samples.some((value) => /^\d{4}-\d{2}-\d{2}(?:$|[T\s])/.test(String(value ?? '').trim()));
    const dateLike = /DATE|TIME/i.test(field?.type || '') || hasIsoDate;
    if (dateLike) options.push(['YEAR', 'Year'], ['QUARTER', 'Quarter'], ['MONTH', 'Month'], ['WEEK', 'Week starting Monday'], ['DAY', 'Day']);
    else if (field?.numeric) options.push(['RANGE', 'Numeric range']);
    else options.push(['PREFIX', 'First characters']);
    return options;
  }

  function addOptions(select, fields, selected) {
    fields.forEach((field) => { const option = document.createElement('option'); option.value = field.token; option.textContent = field.label; select.append(option); });
    if (fields.some((field) => field.token === selected)) select.value = selected;
  }

  function makeLevelRow(level, index, fields) {
    const row = document.createElement('section'); row.className = 'report-design-level'; row.dataset.reportDesignLevel = level.id;
    const titleRow = document.createElement('div'); titleRow.className = 'report-design-level-top';
    const title = document.createElement('strong'); title.textContent = `${String(index + 1).padStart(2, '0')} · ${level.type === 'group' ? 'Group' : 'Sort'}`;
    const actions = document.createElement('div'); actions.className = 'report-design-level-actions-inline';
    [['↑', 'up', index === 0], ['↓', 'down', index === reportDesignLevels.length - 1], ['×', 'remove', false]].forEach(([caption, action, disabled]) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'text-button'; button.textContent = caption; button.disabled = disabled; button.dataset.reportDesignLevelAction = action;
      button.setAttribute('aria-label', `${action === 'remove' ? 'Remove' : action === 'up' ? 'Move up' : 'Move down'} level ${index + 1}`); actions.append(button);
    });
    titleRow.append(title, actions); row.append(titleRow);

    const field = document.createElement('select'); field.className = 'text-input'; field.dataset.reportDesignLevelField = ''; field.setAttribute('aria-label', `Field for level ${index + 1}`); addOptions(field, fields, level.fieldToken);
    if (field.options.length) level.fieldToken = field.value;
    const type = document.createElement('select'); type.className = 'text-input'; type.dataset.reportDesignLevelType = '';
    [['group', 'Group records'], ['sort', 'Sort only']].forEach(([value, caption]) => { const option = document.createElement('option'); option.value = value; option.textContent = caption; type.append(option); }); type.value = level.type;
    const direction = document.createElement('select'); direction.className = 'text-input'; direction.dataset.reportDesignLevelDirection = '';
    [['ASC', 'Ascending'], ['DESC', 'Descending']].forEach(([value, caption]) => { const option = document.createElement('option'); option.value = value; option.textContent = caption; direction.append(option); }); direction.value = level.direction || 'ASC';
    row.append(field, type, direction);
    if (level.type === 'group') {
      const selectedField = fields.find((item) => item.token === level.fieldToken);
      const interval = document.createElement('select'); interval.className = 'text-input'; interval.dataset.reportDesignInterval = '';
      intervalOptions(selectedField).forEach(([value, caption]) => { const option = document.createElement('option'); option.value = value; option.textContent = caption; interval.append(option); });
      if ([...interval.options].some((option) => option.value === level.interval)) interval.value = level.interval; else level.interval = 'NORMAL';
      row.append(interval);
      if (level.interval === 'PREFIX') {
        const length = document.createElement('input'); length.className = 'text-input'; length.type = 'number'; length.min = '1'; length.max = '5'; length.step = '1'; length.value = String(level.prefixLength || 1); length.dataset.reportDesignPrefix = ''; length.setAttribute('aria-label', `Text prefix length for level ${index + 1}`); row.append(length);
      }
      if (level.interval === 'RANGE') {
        const range = document.createElement('input'); range.className = 'text-input'; range.type = 'number'; range.min = '0.000001'; range.step = 'any'; range.value = String(level.rangeSize || 10); range.dataset.reportDesignRange = ''; range.setAttribute('aria-label', `Numeric range width for level ${index + 1}`); row.append(range);
      }
      const switches = document.createElement('div'); switches.className = 'report-design-level-switches';
      [['showHeader', 'Design header'], ['outputHeader', 'Include header in preview and exports'], ['showFooter', 'Design footer'], ['outputFooter', 'Include footer in preview and exports']].forEach(([key, caption]) => {
        const label = document.createElement('label'); label.className = 'report-design-inline-check'; const check = document.createElement('input'); check.type = 'checkbox'; check.checked = Boolean(level[key]); check.dataset[`reportDesign${key[0].toUpperCase()}${key.slice(1)}`] = '';
        check.setAttribute('aria-label', `${caption} for level ${index + 1}`); label.append(check, document.createTextNode(caption)); switches.append(label);
      });
      const keepWrap = document.createElement('label'); keepWrap.className = 'report-design-inline-check'; const keep = document.createElement('select'); keep.className = 'text-input'; keep.dataset.reportDesignKeep = '';
      [['none', 'Allow page breaks'], ['first', 'Keep header with first row'], ['whole', 'Keep group together']].forEach(([value, caption]) => { const option = document.createElement('option'); option.value = value; option.textContent = caption; keep.append(option); }); keep.value = level.keepTogether || 'first'; keep.setAttribute('aria-label', `Print behavior for level ${index + 1}`); keepWrap.append(keep); switches.append(keepWrap); row.append(switches);
      const totals = document.createElement('div'); totals.className = 'report-design-level-totals';
      const operation = document.createElement('select'); operation.className = 'text-input'; operation.dataset.reportDesignSummary = '';
      [['NONE', 'Record count only'], ['SUM', 'Sum'], ['AVG', 'Average'], ['MIN', 'Minimum'], ['MAX', 'Maximum'], ['COUNT_VALUES', 'Count values']].forEach(([value, caption]) => { const option = document.createElement('option'); option.value = value; option.textContent = caption; operation.append(option); }); operation.value = level.summaryFunction || 'NONE';
      const totalField = document.createElement('select'); totalField.className = 'text-input'; totalField.dataset.reportDesignSummaryField = '';
      const totalChoices = operation.value === 'COUNT_VALUES' ? fields : fields.filter((item) => item.numeric);
      addOptions(totalField, totalChoices, level.summaryFieldToken || '');
      if (totalField.options.length && !level.summaryFieldToken) level.summaryFieldToken = totalField.value;
      totalField.disabled = operation.value === 'NONE' || !totalField.options.length;
      const percentLabel = document.createElement('label'); percentLabel.className = 'report-design-inline-check'; const percent = document.createElement('input'); percent.type = 'checkbox'; percent.checked = Boolean(level.showPercent); percent.dataset.reportDesignPercent = ''; percentLabel.append(percent, document.createTextNode('% of grand total'));
      percent.disabled = operation.value !== 'SUM';
      totals.append(operation, totalField, percentLabel); row.append(totals);
    }
    return row;
  }

  function renderLevels(fields) {
    const host = document.querySelector('#report-design-levels'); host.replaceChildren();
    if (!reportDesignLevels.length) { const empty = document.createElement('div'); empty.className = 'report-design-empty'; empty.textContent = 'No group or sort levels yet.'; host.append(empty); }
    reportDesignLevels.forEach((level, index) => host.append(makeLevelRow(level, index, fields)));
  }

  function controlsForSection(key, fields) {
    return reportDesignControls.filter((control) => control.sectionKey === key).map((control) => {
      const field = fields.find((item) => item.token === control.token);
      const card = document.createElement('div'); card.className = 'report-design-control'; card.draggable = true; card.dataset.reportDesignControlId = String(control.id);
      const name = document.createElement('span');
      const isLabel = control.kind === 'label';
      name.textContent = isLabel ? `Label · ${control.text}` : field?.name || 'Unavailable field';
      const actions = document.createElement('div'); actions.className = 'report-design-control-actions';
      [['↑', 'up'], ['↓', 'down'], ['×', 'remove']].forEach(([caption, action]) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = caption; button.dataset.reportDesignControlAction = action;
        button.setAttribute('aria-label', `${action} ${isLabel ? `label ${control.text}` : field?.name || 'field'} ${action === 'remove' ? 'from report' : 'in section'}`); actions.append(button);
      });
      card.append(name, actions); return card;
    });
  }

  function renderCanvas(fields) {
    const canvas = document.querySelector('#report-design-canvas'); canvas.replaceChildren();
    sections(fields).forEach(([key, label, note]) => {
      const section = document.createElement('section'); section.className = `report-design-section section-${key.split(':')[0]}`; section.dataset.reportDesignSection = key;
      const heading = document.createElement('header'); heading.className = 'report-design-section-heading';
      const title = document.createElement('strong'); title.textContent = label; const help = document.createElement('span'); help.textContent = note; heading.append(title, help);
      const groupMatch = key.match(/^(level-\d+):(header|footer)$/);
      if (groupMatch) {
        const level = reportDesignLevels.find((item) => item.id === groupMatch[1]);
        if (groupMatch[2] === 'header') {
          const outputLabel = document.createElement('label'); outputLabel.className = 'report-design-output-toggle';
          const outputCheck = document.createElement('input'); outputCheck.type = 'checkbox'; outputCheck.checked = level?.hideGroupLabel === true;
          outputCheck.dataset.reportDesignGroupLabel = groupMatch[1];
          outputCheck.setAttribute('aria-label', 'Hide group value');
          outputLabel.append(outputCheck, document.createTextNode('Hide group value'));
          heading.append(outputLabel);
        }
      }
      const dropzone = document.createElement('div'); dropzone.className = 'report-design-dropzone'; dropzone.dataset.reportDesignDropzone = key;
      const controls = controlsForSection(key, fields); controls.forEach((control) => dropzone.append(control));
      if (!controls.length) { const empty = document.createElement('span'); empty.className = 'report-design-drop-hint'; empty.textContent = key === 'detail' ? 'Drag fields here or add them from the field list.' : 'Drop fields here to place them in this section.'; dropzone.append(empty); }
      section.append(heading, dropzone); canvas.append(section);
    });
  }

  function render(fields = fieldsForDesign()) {
    document.querySelector('#report-design-source-mode').value = reportDesignSourceMode;
    document.querySelector('#report-design-related-controls').hidden = reportDesignSourceMode !== 'related';
    const note = document.querySelector('#report-design-query-source'); note.hidden = reportDesignSourceMode !== 'query';
    if (reportDesignSourceMode === 'query') note.textContent = lastQueryResultSet
      ? `Latest SQL Editor result · ${lastQueryResultSet.values.length} rows · ${lastQueryResultSet.columns.length} fields.`
      : 'No SQL results are available. Run a SELECT query in SQL Editor, then return here.';
    renderSectionPlacementOptions(fields); renderFieldList(fields); renderLevels(fields); renderCanvas(fields);
    document.querySelectorAll('[data-report-section]').forEach((input) => { input.checked = Boolean(reportDesignSections[input.dataset.reportSection]); });
    document.querySelector('#report-design-grand-total-options').hidden = !document.querySelector('#report-design-grand-total').checked;
    const select = document.querySelector('#report-design-grand-field'); const old = select.value; select.replaceChildren();
    const totalOperation = document.querySelector('#report-design-grand-function').value;
    const choices = totalOperation === 'COUNT_VALUES' ? fields : fields.filter((field) => field.numeric);
    choices.forEach((field) => { const option = document.createElement('option'); option.value = field.token; option.textContent = field.label; select.append(option); });
    if (choices.some((field) => field.token === old)) select.value = old;
    select.disabled = !choices.length || !document.querySelector('#report-design-grand-total').checked;
  }

  function renderSectionPlacementOptions(fields) {
    const available = sections(fields);
    [
      ['#report-design-field-section', 'detail'],
      ['#report-design-label-section', 'report-header'],
    ].forEach(([selector, fallback]) => {
      const select = document.querySelector(selector); const previous = select.value;
      select.replaceChildren();
      available.forEach(([key, label]) => { const option = document.createElement('option'); option.value = key; option.textContent = label; select.append(option); });
      if ([...select.options].some((option) => option.value === previous)) select.value = previous;
      else if ([...select.options].some((option) => option.value === fallback)) select.value = fallback;
    });
  }

  function refreshSources() {
    const table = document.querySelector('#report-design-table'); const old = table.value; table.replaceChildren();
    listTables().forEach((name) => { const option = document.createElement('option'); option.value = name; option.textContent = name; table.append(option); });
    if ([...table.options].some((option) => option.value === old)) table.value = old; else if (table.options.length) table.selectedIndex = 0;
    table.disabled = !table.options.length;
    const available = fieldsForDesign();
    if (available.length) {
      const tokens = new Set(available.map((field) => field.token));
      reportDesignControls = reportDesignControls.filter((control) => control.kind === 'label' || tokens.has(control.token));
      const validLevels = new Set(reportDesignLevels.filter((level) => tokens.has(level.fieldToken)).map((level) => level.id));
      reportDesignControls.forEach((control) => {
        if (control.sectionKey.endsWith(':header') || control.sectionKey.endsWith(':footer')) {
          const id = control.sectionKey.slice(0, control.sectionKey.lastIndexOf(':'));
          if (!validLevels.has(id)) control.sectionKey = 'detail';
        }
      });
      reportDesignLevels = reportDesignLevels.filter((level) => tokens.has(level.fieldToken));
    }
    render(available);
  }

  function levelStateFromRow(row) {
    const level = reportDesignLevels.find((item) => item.id === row.dataset.reportDesignLevel); if (!level) return;
    level.fieldToken = row.querySelector('[data-report-design-level-field]')?.value || '';
    level.type = row.querySelector('[data-report-design-level-type]')?.value === 'sort' ? 'sort' : 'group';
    level.direction = row.querySelector('[data-report-design-level-direction]')?.value === 'DESC' ? 'DESC' : 'ASC';
    level.interval = row.querySelector('[data-report-design-interval]')?.value || 'NORMAL';
    level.prefixLength = Math.max(1, Math.min(5, Number(row.querySelector('[data-report-design-prefix]')?.value) || 1));
    level.rangeSize = Math.max(Number.EPSILON, Number(row.querySelector('[data-report-design-range]')?.value) || 10);
    level.showHeader = Boolean(row.querySelector('[data-report-design-show-header]')?.checked);
    level.showFooter = Boolean(row.querySelector('[data-report-design-show-footer]')?.checked);
    level.outputHeader = Boolean(row.querySelector('[data-report-design-output-header]')?.checked);
    level.outputFooter = Boolean(row.querySelector('[data-report-design-output-footer]')?.checked);
    level.repeatHeader = false;
    level.keepTogether = row.querySelector('[data-report-design-keep]')?.value || 'first';
    level.summaryFunction = row.querySelector('[data-report-design-summary]')?.value || 'NONE';
    level.summaryFieldToken = row.querySelector('[data-report-design-summary-field]')?.value || '';
    level.showPercent = Boolean(row.querySelector('[data-report-design-percent]')?.checked);
  }

  function addLevel(type) {
    if (reportDesignLevels.length >= maxLevels) { feedback('A report can have up to 10 group and sort levels.', true); return; }
    const fields = fieldsForDesign(); if (!fields.length) { feedback('Choose a report source with fields first.', true); return; }
    const field = fields.find((item) => !reportDesignLevels.some((level) => level.fieldToken === item.token)) || fields[0];
    reportDesignLevels.push({ id: `level-${reportDesignNextId++}`, type, fieldToken: field.token, direction: 'ASC', interval: 'NORMAL', prefixLength: 1, rangeSize: 10, showHeader: type === 'group', showFooter: type === 'group', hideGroupLabel: false, outputHeader: true, outputFooter: true, repeatHeader: false, keepTogether: 'first', summaryFunction: 'NONE', summaryFieldToken: '', showPercent: false });
    invalidatePreview(); render(); feedback(`${type === 'group' ? 'Group' : 'Sort'} level added.`);
  }

  function sectionChanged(input) {
    reportDesignSections[input.dataset.reportSection] = input.checked; invalidatePreview(); render();
  }

  function setView(mode) {
    reportDesignViewMode = mode === 'preview' ? 'preview' : 'design';
    document.querySelector('#report-design-canvas').hidden = reportDesignViewMode !== 'design';
    document.querySelector('#report-design-preview').hidden = reportDesignViewMode !== 'preview' || !reportDesignPreviewReady;
    document.querySelector('#report-design-placeholder').hidden = true;
    const design = document.querySelector('#report-design-view-canvas'); const preview = document.querySelector('#report-design-view-preview');
    design.classList.toggle('is-active', reportDesignViewMode === 'design'); preview.classList.toggle('is-active', reportDesignViewMode === 'preview');
    design.setAttribute('aria-pressed', String(reportDesignViewMode === 'design')); preview.setAttribute('aria-pressed', String(reportDesignViewMode === 'preview'));
  }

  function invalidatePreview() {
    reportDesignPreviewReady = false;
    document.querySelector('#report-design-print').disabled = true;
    document.querySelector('#report-design-export-excel').disabled = true;
    document.querySelector('#report-design-export-word').disabled = true;
    document.querySelector('#report-design-preview').hidden = true;
    const status = document.querySelector('#report-design-feedback');
    status.textContent = ''; status.classList.remove('is-error');
    if (reportDesignViewMode === 'preview') setView('design');
  }

  function referenceRows(definition) {
    const fields = fieldsForDesign();
    const resolve = (ref) => findField(ref, fields);
    reportDesignSourceMode = definition.sourceMode;
    document.querySelector('#report-design-source-mode').value = definition.sourceMode;
    if (definition.sourceMode === 'related') document.querySelector('#report-design-table').value = definition.table;
    reportDesignSections = { ...sectionDefaults, ...(definition.sections || {}) };
    document.querySelector('#report-design-title').value = definition.title || 'Database report';
    reportDesignControls = (definition.controls || []).map((control) => control.kind === 'label'
      ? ({ id: reportDesignNextId++, kind: 'label', text: String(control.text || ''), sectionKey: control.sectionKey })
      : ({ id: reportDesignNextId++, kind: 'field', token: resolve(control.field)?.token, sectionKey: control.sectionKey }))
      .filter((item) => item.kind === 'label' ? Boolean(item.text) : Boolean(item.token));
    reportDesignLevels = (definition.levels || []).map((level) => ({ ...level, id: level.id || `level-${reportDesignNextId++}`, fieldToken: resolve(level.field)?.token || fields[0]?.token || '', summaryFieldToken: resolve(level.summaryField)?.token || '', hideGroupLabel: typeof level.hideGroupLabel === 'boolean' ? level.hideGroupLabel : level.showGroupLabel === false, showGroupLabel: undefined, outputHeader: level.outputHeader !== false, outputFooter: level.outputFooter !== false })).filter((level) => level.fieldToken);
    document.querySelector('#report-design-show-details').checked = definition.showDetails !== false;
    document.querySelector('#report-design-grand-total').checked = Boolean(definition.grandTotal?.enabled);
    document.querySelector('#report-design-grand-function').value = definition.grandTotal?.operation || 'SUM';
    render(); const total = resolve(definition.grandTotal?.field); if (total) document.querySelector('#report-design-grand-field').value = total.token;
    invalidatePreview(); setView('design');
  }

  function definitionForSave() {
    const fields = fieldsForDesign();
    if (!reportDesignControls.length) throw new Error('Add at least one field to a report section before saving.');
    if (reportDesignSourceMode === 'query' && (!lastQueryResultSet || !lastQuerySqlText)) throw new Error('Run a SQL query before saving a query-based design.');
    const byToken = new Map(fields.map((field) => [field.token, fieldReference(field)]));
    return {
      version: 1, kind: 'access-report-design', sourceMode: reportDesignSourceMode,
      table: reportDesignSourceMode === 'related' ? rootTable() : null,
      title: document.querySelector('#report-design-title').value.trim() || 'Database report',
      controls: reportDesignControls.map((control) => control.kind === 'label'
        ? ({ kind: 'label', text: control.text, sectionKey: control.sectionKey })
        : ({ kind: 'field', field: byToken.get(control.token), sectionKey: control.sectionKey })),
      levels: reportDesignLevels.map((level) => ({ ...level, field: byToken.get(level.fieldToken), summaryField: byToken.get(level.summaryFieldToken) || null, fieldToken: undefined, summaryFieldToken: undefined })),
      sections: { ...reportDesignSections }, showDetails: document.querySelector('#report-design-show-details').checked,
      grandTotal: { enabled: document.querySelector('#report-design-grand-total').checked, operation: document.querySelector('#report-design-grand-function').value, field: byToken.get(document.querySelector('#report-design-grand-field').value) || null },
      querySql: reportDesignSourceMode === 'query' ? lastQuerySqlText : '',
    };
  }

  function refreshSaved(selectedName = document.querySelector('#report-design-saved-select').value) {
    const select = document.querySelector('#report-design-saved-select'); select.replaceChildren();
    const rows = db.exec(`SELECT design_name FROM ${quoteIdentifier(SAVED_REPORT_DESIGNS_TABLE)} ORDER BY design_name COLLATE NOCASE;`)[0]?.values || [];
    const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = rows.length ? 'Choose a saved design…' : 'No saved designs yet'; select.append(placeholder);
    rows.forEach(([name]) => { const option = document.createElement('option'); option.value = name; option.textContent = name; select.append(option); });
    if (rows.some(([name]) => name === selectedName)) select.value = selectedName;
    document.querySelector('#report-design-load').disabled = !select.value; document.querySelector('#report-design-delete').disabled = !select.value;
  }

  async function saveDesign(storage) {
    const data = definitionForSave(); const select = document.querySelector('#report-design-saved-select');
    const name = await askForSavedReportName(select.value); if (name === null) return;
    const lookup = db.prepare(`SELECT 1 FROM ${quoteIdentifier(SAVED_REPORT_DESIGNS_TABLE)} WHERE design_name = ?;`); let exists;
    try { lookup.bind([name]); exists = lookup.step(); } finally { lookup.free(); }
    if (exists && !await askForAppConfirmation('Replace report design?', `A report design named “${name}” already exists. Replace it?`, 'Replace')) return;
    const statement = db.prepare(exists
      ? `UPDATE ${quoteIdentifier(SAVED_REPORT_DESIGNS_TABLE)} SET design_json = ?, updated_at = CURRENT_TIMESTAMP WHERE design_name = ?;`
      : `INSERT INTO ${quoteIdentifier(SAVED_REPORT_DESIGNS_TABLE)} (design_name, design_json) VALUES (?, ?);`);
    try { statement.run(exists ? [JSON.stringify(data), name] : [name, JSON.stringify(data)]); } finally { statement.free(); }
    await saveDatabase(storage); refreshSaved(name); feedback(`Saved “${name}” with this database.`, false, true);
  }

  function loadDesign(storage) {
    const name = document.querySelector('#report-design-saved-select').value; if (!name) return;
    const statement = db.prepare(`SELECT design_json FROM ${quoteIdentifier(SAVED_REPORT_DESIGNS_TABLE)} WHERE design_name = ?;`); let raw;
    try { statement.bind([name]); if (statement.step()) raw = statement.getAsObject().design_json; } finally { statement.free(); }
    try {
      const definition = JSON.parse(raw);
      if (definition?.version !== 1 || definition?.kind !== 'access-report-design' || !['related', 'query'].includes(definition.sourceMode)) throw new Error('This saved report design has an unsupported format.');
      if (definition.sourceMode === 'related') {
        if (!listTables().includes(definition.table)) throw new Error(`The starting table “${definition.table}” is not in this database.`);
        document.querySelector('#report-design-source-mode').value = 'related'; document.querySelector('#report-design-table').value = definition.table;
        reportDesignSourceMode = 'related'; refreshSources(); referenceRows(definition); activateTab('report-design'); feedback(`Loaded “${name}”.`, false, true); return;
      }
      reportDesignSourceMode = 'query'; document.querySelector('#report-design-source-mode').value = 'query';
      if (lastQueryResultSet && lastQuerySqlText.trim() === String(definition.querySql || '').trim()) {
        refreshSources(); referenceRows(definition); activateTab('report-design'); feedback(`Loaded “${name}”.`, false, true); return;
      }
      reportDesignPendingDefinition = definition; lastQueryResultSet = null; lastQuerySqlText = '';
      elements.sqlInput.value = definition.querySql || ''; updateJoinDiagram(); scheduleQueryDraftSave(storage); renderResults([]);
      invalidatePreview(); refreshSources(); activateTab('editor'); feedback(`Loaded “${name}”. Run its SQL to open the saved design.`, false, true);
    } catch (error) { feedback(error.message || 'The report design could not be loaded.', true, true); }
  }

  async function deleteDesign(storage) {
    const select = document.querySelector('#report-design-saved-select'); const name = select.value; if (!name) return;
    if (!await askForAppConfirmation('Delete report design?', `Delete the saved report design “${name}”?`, 'Delete')) return;
    const statement = db.prepare(`DELETE FROM ${quoteIdentifier(SAVED_REPORT_DESIGNS_TABLE)} WHERE design_name = ?;`);
    try { statement.run([name]); } finally { statement.free(); }
    await saveDatabase(storage); refreshSaved(); feedback(`Deleted “${name}”.`, false, true);
  }

  function groupValue(raw, level) {
    if (raw === null || raw === undefined || raw === '') return { key: 'blank', label: '(blank)', sort: '' };
    const value = String(raw);
    switch (level.interval) {
      case 'YEAR': return { key: value.slice(0, 4), label: value.slice(0, 4), sort: value.slice(0, 4) };
      case 'QUARTER': { const match = value.match(/^(\d{4})-(\d{2})/); if (match) { const q = Math.floor((Number(match[2]) - 1) / 3) + 1; return { key: `${match[1]}-Q${q}`, label: `Q${q} ${match[1]}`, sort: `${match[1]}-${q}` }; } break; }
      case 'MONTH': return { key: value.slice(0, 7), label: value.slice(0, 7), sort: value.slice(0, 7) };
      case 'DAY': return { key: value.slice(0, 10), label: value.slice(0, 10), sort: value.slice(0, 10) };
      case 'WEEK': { const date = new Date(`${value.slice(0, 10)}T00:00:00Z`); if (!Number.isNaN(date.valueOf())) { date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7)); const monday = date.toISOString().slice(0, 10); return { key: monday, label: `Week of ${monday}`, sort: monday }; } break; }
      case 'PREFIX': { const prefix = value.slice(0, Math.max(1, Math.min(5, Number(level.prefixLength) || 1))); return { key: prefix.toLocaleLowerCase(), label: `${prefix}…`, sort: prefix }; }
      case 'RANGE': { const width = Math.max(Number.EPSILON, Number(level.rangeSize) || 10); const lower = Math.floor(Number(raw) / width) * width; if (Number.isFinite(lower)) return { key: String(lower), label: `${lower} to < ${lower + width}`, sort: lower }; break; }
      default: break;
    }
    return { key: `${typeof raw}:${value}`, label: value, sort: raw };
  }

  function sortRows(rows, levels, fields) {
    const compare = (a, b) => compareReportValues(a, b);
    return rows.sort((left, right) => {
      for (const level of levels) {
        const field = fields.find((item) => item.token === level.fieldToken); if (!field) continue;
        const a = left[level.fieldToken]; const b = right[level.fieldToken];
        const av = level.type === 'group' ? groupValue(a, level).sort : a;
        const bv = level.type === 'group' ? groupValue(b, level).sort : b;
        const result = compare(av, bv); if (result) return level.direction === 'DESC' ? -result : result;
      }
      return 0;
    });
  }

  function buildRows(fields) {
    const usedTokens = [...new Set([
      ...reportDesignControls.filter((item) => item.kind !== 'label').map((item) => item.token), ...reportDesignLevels.map((item) => item.fieldToken),
      ...reportDesignLevels.filter((item) => (item.summaryFunction || 'NONE') !== 'NONE').map((item) => item.summaryFieldToken).filter(Boolean),
      ...(document.querySelector('#report-design-grand-total').checked ? [document.querySelector('#report-design-grand-field').value] : []),
    ].filter(Boolean))];
    if (!usedTokens.length && fields.length) usedTokens.push(fields[0].token);
    const needed = usedTokens.map((token) => fields.find((field) => field.token === token)).filter(Boolean);
    if (!needed.length) throw new Error('Add fields to the report design before creating a preview.');
    let values;
    if (reportDesignSourceMode === 'query') {
      if (!lastQueryResultSet) throw new Error('Run a SELECT query in SQL Editor before using this source.');
      values = lastQueryResultSet.values.map((row) => Object.fromEntries(needed.map((field) => [field.token, row[field.index]])));
    } else {
      const root = rootTable(); if (!root) throw new Error('Create or import a table before designing a report.');
      const joins = buildReportJoins(needed, root);
      const sqlFields = needed.map((field) => `${quoteIdentifier(field.table)}.${quoteIdentifier(field.name)} AS ${quoteIdentifier(field.token)}`);
      let sql = `SELECT ${sqlFields.join(', ')} FROM ${quoteIdentifier(root)}`;
      for (const join of joins) {
        const relation = getRelationships().find((item) => item.key === join.key); if (!relation) throw new Error(`The saved relationship to ${join.toTable} no longer exists.`);
        const conditions = relation.from.map((child, index) => `${quoteIdentifier(relation.childTable)}.${quoteIdentifier(child)} = ${quoteIdentifier(relation.targetTable)}.${quoteIdentifier(relation.to[index])}`);
        sql += ` LEFT JOIN ${quoteIdentifier(join.toTable)} ON ${conditions.join(' AND ')}`;
      }
      const result = db.exec(`${sql};`)[0]; if (!result) throw new Error('The report query returned no result set.');
      values = result.values.map((row) => Object.fromEntries(needed.map((field, index) => [field.token, row[index]])));
    }
    return { rows: sortRows(values, reportDesignLevels, fields), source: reportDesignSourceMode === 'query' ? 'Latest SQL Editor result' : rootTable() };
  }

  function displayValue(value) { return value === null || value === undefined ? '(blank)' : value instanceof Uint8Array ? `[BLOB · ${value.byteLength} bytes]` : String(value); }
  function addControlOutputs(host, sectionKey, row, fields) {
    const controls = reportDesignControls.filter((item) => item.sectionKey === sectionKey);
    if (!controls.length) return;
    const line = document.createElement('div'); line.className = 'report-design-output-controls';
    controls.forEach((control) => {
      const field = fields.find((item) => item.token === control.token); const item = document.createElement('span');
      item.textContent = control.kind === 'label' ? control.text : `${field?.name || 'Field'}: ${displayValue(row?.[control.token])}`;
      line.append(item);
    });
    host.append(line);
  }

  function numericSummary(rows, operation, token) {
    if (operation === 'COUNT_VALUES') return String(rows.filter((row) => row[token] !== null && row[token] !== undefined && row[token] !== '').length);
    const values = rows.map((row) => row[token]).filter((value) => value !== null && value !== undefined && value !== '').map(Number).filter(Number.isFinite);
    if (!values.length) return '—';
    if (operation === 'SUM') return values.reduce((sum, value) => sum + value, 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (operation === 'AVG') return (values.reduce((sum, value) => sum + value, 0) / values.length).toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (operation === 'MIN') return Math.min(...values).toLocaleString(undefined, { maximumFractionDigits: 2 });
    if (operation === 'MAX') return Math.max(...values).toLocaleString(undefined, { maximumFractionDigits: 2 });
    return String(rows.length);
  }

  function groupPartitions(rows, level, fields) {
    const field = fields.find((item) => item.token === level.fieldToken); if (!field) return [{ value: { key: 'all', label: 'All records' }, rows }];
    const partitions = [];
    for (const row of rows) {
      const value = groupValue(row[level.fieldToken], level); const previous = partitions.at(-1);
      if (!previous || previous.value.key !== value.key) partitions.push({ value, rows: [row] }); else previous.rows.push(row);
    }
    return partitions;
  }

  function appendGroupHeader(body, level, field, partition, fields, detailCount) {
    if (!level.showHeader || level.outputHeader === false) return;
    if (!level.hideGroupLabel) {
      const row = document.createElement('tr'); row.className = `report-group-heading level-${Math.min(3, reportDesignLevels.filter((item) => item.type === 'group').indexOf(level) + 1)} ${level.keepTogether === 'first' ? 'keep-first' : ''}`;
      const cell = document.createElement('th'); cell.colSpan = Math.max(1, detailCount); cell.textContent = `${field?.name || 'Group'}: ${partition.value.label}`; row.append(cell); body.append(row);
    }
    const controls = makeOutputControlLine(partition.rows[0], fields, `${level.id}:header`, level.hideGroupLabel ? level.fieldToken : null);
    if (controls) {
      if (level.keepTogether === 'first') controls.classList.add('group-header-controls-keep-first');
      body.append(controls);
    }
  }

  function appendGroupFooter(body, level, partition, rows, fields, detailCount) {
    if (!level.showFooter || level.outputFooter === false) return;
    const row = document.createElement('tr'); row.className = `report-group-footer keep-${level.keepTogether || 'first'}`;
    const cell = document.createElement('td'); cell.colSpan = Math.max(1, detailCount);
    const field = fields.find((item) => item.token === level.summaryFieldToken);
    let summary = `${partition.rows.length} record${partition.rows.length === 1 ? '' : 's'}`;
    if (level.summaryFunction && level.summaryFunction !== 'NONE' && field) {
      const value = numericSummary(partition.rows, level.summaryFunction, field.token);
      summary += ` · ${level.summaryFunction.replace('_VALUES', ' values').replace('AVG', 'Average').replace('MIN', 'Minimum').replace('MAX', 'Maximum').replace('SUM', 'Sum')} ${field.name}: ${value}`;
      if (level.showPercent && level.summaryFunction === 'SUM') {
        const total = rows.reduce((sum, item) => sum + (Number(item[field.token]) || 0), 0);
        const local = partition.rows.reduce((sum, item) => sum + (Number(item[field.token]) || 0), 0);
        if (total) summary += ` · ${(local / total * 100).toFixed(1)}% of total`;
      }
    }
    cell.textContent = summary; row.append(cell); body.append(row);
    const controls = makeOutputControlLine(partition.rows.at(-1), fields, `${level.id}:footer`); if (controls) body.append(controls);
  }

  function appendDetails(body, rows, detailControls, fields) {
    rows.forEach((record) => {
      const row = document.createElement('tr'); row.className = 'report-design-detail-row';
      detailControls.forEach((control) => {
        const cell = document.createElement('td'); const value = record[control.token];
        if (control.kind === 'label') cell.textContent = control.text;
        else {
          cell.textContent = value === null || value === undefined ? '' : displayValue(value);
          if (typeof value === 'number' && Number.isFinite(value)) { cell.dataset.exportType = 'number'; cell.dataset.exportValue = String(value); }
        }
        row.append(cell);
      });
      body.append(row);
    });
  }

  function appendNestedGroups(body, rows, groups, index, allRows, fields, detailControls, detailColumnCount = detailControls.length) {
    if (index >= groups.length) { if (document.querySelector('#report-design-show-details').checked) appendDetails(body, rows, detailControls, fields); return; }
    const level = groups[index]; const field = fields.find((item) => item.token === level.fieldToken);
    for (const partition of groupPartitions(rows, level, fields)) {
      const section = body.tagName === 'TABLE' ? document.createElement('tbody') : body;
      if (section !== body) { section.className = `report-design-group-block keep-${level.keepTogether || 'first'}`; body.append(section); }
      appendGroupHeader(section, level, field, partition, fields, Math.max(1, detailColumnCount));
      appendNestedGroups(section, partition.rows, groups, index + 1, allRows, fields, detailControls, detailColumnCount);
      appendGroupFooter(section, level, partition, allRows, fields, Math.max(1, detailColumnCount));
    }
  }

  function makeOutputControlLine(row, fields, key, hiddenFieldToken = null) {
    const controlItems = reportDesignControls.filter((item) => item.sectionKey === key && !(hiddenFieldToken && item.kind !== 'label' && item.token === hiddenFieldToken));
    if (!controlItems.length) return null;
    const tr = document.createElement('tr'); tr.className = 'report-design-section-controls'; const td = document.createElement('td'); td.colSpan = Math.max(1, document.querySelector('#report-design-show-details').checked ? reportDesignControls.filter((item) => item.sectionKey === 'detail').length : 0);
    const line = document.createElement('div'); line.className = 'report-design-output-controls';
    controlItems.forEach((control) => {
      const field = fields.find((item) => item.token === control.token); const span = document.createElement('span');
      span.textContent = control.kind === 'label' ? control.text : `${field?.name || 'Field'}: ${displayValue(row?.[control.token])}`;
      line.append(span);
    });
    td.append(line); tr.append(td); return tr;
  }

  function generatePreview() {
    try {
      const fields = fieldsForDesign();
      const detailControls = reportDesignControls.filter((item) => item.sectionKey === 'detail');
      const showDetails = document.querySelector('#report-design-show-details').checked;
      const detailColumnCount = showDetails ? detailControls.length : 0;
      const groups = reportDesignLevels.filter((item) => item.type === 'group');
      if (!reportDesignControls.length && !groups.length) throw new Error('Add a field to a report section or add a group level.');
      if (!groups.length && !showDetails && !document.querySelector('#report-design-grand-total').checked) throw new Error('Summary-only reports need a group level or grand total.');
      const built = buildRows(fields); const rows = built.rows;
      const preview = document.querySelector('#report-design-preview'); preview.replaceChildren();
      const reportHeader = document.createElement('header'); reportHeader.className = 'report-page-header';
      const eyebrow = document.createElement('div'); eyebrow.className = 'eyebrow'; eyebrow.textContent = 'REPORT DESIGN PREVIEW';
      const title = document.createElement('h1'); title.textContent = document.querySelector('#report-design-title').value.trim() || 'Database report';
      const meta = document.createElement('div'); meta.className = 'report-page-meta'; const source = document.createElement('span'); source.textContent = `Source: ${built.source}`; const date = document.createElement('span'); date.textContent = new Date().toLocaleString(); meta.append(source, date); reportHeader.append(eyebrow, title, meta);
      addControlOutputs(reportHeader, 'report-header', rows[0], fields); if (reportDesignSections['report-header']) preview.append(reportHeader);
      const table = document.createElement('table'); table.className = 'report-data-table';
      const thead = document.createElement('thead'); const heading = document.createElement('tr');
      if (showDetails) detailControls.forEach((control) => {
        const cell = document.createElement('th');
        cell.textContent = control.kind === 'label' ? control.text : fields.find((field) => field.token === control.token)?.name || 'Field';
        heading.append(cell);
      });
      if (showDetails && detailControls.length) thead.append(heading);
      const pageHeader = makeOutputControlLine(rows[0], fields, 'page-header'); if (pageHeader && reportDesignSections['page-header']) thead.append(pageHeader);
      if (thead.children.length) table.append(thead);
      const pageFooter = makeOutputControlLine(rows.at(-1), fields, 'page-footer'); if (pageFooter && reportDesignSections['page-footer']) { const tfoot = document.createElement('tfoot'); tfoot.append(pageFooter); table.append(tfoot); }
      if (groups.length) appendNestedGroups(table, rows, groups, 0, rows, fields, detailControls, detailColumnCount);
      else {
        const detailBody = document.createElement('tbody');
        if (showDetails) appendDetails(detailBody, rows, detailControls, fields);
        table.append(detailBody);
      }
      if (!rows.length) { const emptyBody = document.createElement('tbody'); const empty = document.createElement('tr'); const cell = document.createElement('td'); cell.colSpan = Math.max(1, detailColumnCount); cell.textContent = 'No records match this report.'; empty.append(cell); emptyBody.append(empty); table.append(emptyBody); }
      preview.append(table);
      if (reportDesignSections['report-footer']) {
        const footer = document.createElement('footer'); footer.className = 'report-page-footer'; const count = document.createElement('span'); count.textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`; const name = document.createElement('span'); name.textContent = title.textContent; footer.append(count, name);
        addControlOutputs(footer, 'report-footer', rows.at(-1), fields);
        if (document.querySelector('#report-design-grand-total').checked) {
          const token = document.querySelector('#report-design-grand-field').value; const field = fields.find((item) => item.token === token);
          if (field) { const total = document.createElement('div'); total.className = 'report-design-grand-total'; total.textContent = `${document.querySelector('#report-design-grand-function').selectedOptions[0]?.textContent || 'Total'} ${field.name}: ${numericSummary(rows, document.querySelector('#report-design-grand-function').value, token)}`; footer.append(total); }
        }
        preview.append(footer);
      }
      reportDesignPreviewReady = true; document.querySelector('#report-design-print').disabled = false;
      document.querySelector('#report-design-export-excel').disabled = false; document.querySelector('#report-design-export-word').disabled = false;
      setView('preview');
      feedback(`Preview ready · ${rows.length} record${rows.length === 1 ? '' : 's'} · ${groups.length} group level${groups.length === 1 ? '' : 's'}.`);
    } catch (error) { invalidatePreview(); feedback(error.message || 'Could not generate this report preview.', true); }
  }

  function persistableDefinition(definition) {
    const fields = fieldsForDesign(); const resolve = (ref) => findField(ref, fields);
    reportDesignSourceMode = definition.sourceMode; document.querySelector('#report-design-source-mode').value = definition.sourceMode;
    queryColumnSignature = reportDesignSourceMode === 'query' ? JSON.stringify(lastQueryResultSet?.columns || []) || null : null;
    if (definition.sourceMode === 'related') document.querySelector('#report-design-table').value = definition.table;
    reportDesignSections = { ...sectionDefaults, ...(definition.sections || {}) };
    document.querySelector('#report-design-title').value = definition.title || 'Database report';
    reportDesignControls = (definition.controls || []).map((item) => item.kind === 'label'
      ? ({ id: reportDesignNextId++, kind: 'label', text: String(item.text || ''), sectionKey: item.sectionKey })
      : ({ id: reportDesignNextId++, kind: 'field', token: resolve(item.field)?.token, sectionKey: item.sectionKey }))
      .filter((item) => item.kind === 'label' ? Boolean(item.text) : Boolean(item.token));
    reportDesignLevels = (definition.levels || []).map((item) => ({ ...item, id: item.id || `level-${reportDesignNextId++}`, fieldToken: resolve(item.field)?.token || fields[0]?.token || '', summaryFieldToken: resolve(item.summaryField)?.token || '', hideGroupLabel: typeof item.hideGroupLabel === 'boolean' ? item.hideGroupLabel : item.showGroupLabel === false, showGroupLabel: undefined, outputHeader: item.outputHeader !== false, outputFooter: item.outputFooter !== false })).filter((item) => item.fieldToken);
    document.querySelector('#report-design-show-details').checked = definition.showDetails !== false;
    document.querySelector('#report-design-grand-total').checked = Boolean(definition.grandTotal?.enabled);
    document.querySelector('#report-design-grand-function').value = definition.grandTotal?.operation || 'SUM';
    render(); const total = resolve(definition.grandTotal?.field); if (total) document.querySelector('#report-design-grand-field').value = total.token;
    invalidatePreview(); setView('design');
  }

  function restorePending() {
    const definition = reportDesignPendingDefinition;
    if (!definition || !lastQueryResultSet || lastQuerySqlText.trim() !== String(definition.querySql || '').trim()) return false;
    reportDesignPendingDefinition = null; refreshSources(); persistableDefinition(definition); activateTab('report-design');
    feedback('Saved query finished. Report design restored; choose Preview to inspect it.', false, true); return true;
  }

  function queryChanged() {
    const signature = JSON.stringify(lastQueryResultSet?.columns || []);
    if (reportDesignSourceMode === 'query' && queryColumnSignature && signature !== queryColumnSignature) {
      reportDesignControls = []; reportDesignLevels = [];
      feedback('The SQL result fields changed. Re-add fields and group levels for this source.');
    }
    queryColumnSignature = signature || null;
    refreshSources(); invalidatePreview();
  }

  function resetForDatabase() {
    reportDesignSourceMode = 'related';
    reportDesignLevels = []; reportDesignControls = []; reportDesignSections = { ...sectionDefaults };
    reportDesignPendingDefinition = null; reportDesignPreviewReady = false; reportDesignViewMode = 'design';
    queryColumnSignature = null;
    if (document.querySelector('#report-design-source-mode')) {
      document.querySelector('#report-design-source-mode').value = 'related';
      document.querySelector('#report-design-title').value = 'Grouped report';
      document.querySelector('#report-design-show-details').checked = true;
      document.querySelector('#report-design-grand-total').checked = false;
      document.querySelector('#report-design-grand-function').value = 'SUM';
      render(); invalidatePreview(); setView('design');
    }
  }

  function startNewReport() {
    reportDesignLevels = []; reportDesignControls = []; reportDesignSections = { ...sectionDefaults };
    reportDesignPendingDefinition = null; reportDesignPreviewReady = false; reportDesignViewMode = 'design';
    queryColumnSignature = reportDesignSourceMode === 'query' ? JSON.stringify(lastQueryResultSet?.columns || []) || null : null;
    document.querySelector('#report-design-title').value = 'New report';
    document.querySelector('#report-design-label-text').value = '';
    document.querySelector('#report-design-field-section').value = 'detail';
    document.querySelector('#report-design-label-section').value = 'report-header';
    document.querySelector('#report-design-show-details').checked = true;
    document.querySelector('#report-design-grand-total').checked = false;
    document.querySelector('#report-design-grand-function').value = 'SUM';
    const savedSelect = document.querySelector('#report-design-saved-select');
    savedSelect.value = '';
    document.querySelector('#report-design-load').disabled = true;
    document.querySelector('#report-design-delete').disabled = true;
    document.querySelector('#report-design-saved-feedback').textContent = '';
    render(); invalidatePreview(); setView('design');
    feedback('Started a new report. Saved designs are unchanged.');
  }

  function moveControl(controlId, sectionKey, beforeId = null) {
    const index = reportDesignControls.findIndex((item) => String(item.id) === String(controlId)); if (index < 0) return;
    const [control] = reportDesignControls.splice(index, 1); control.sectionKey = sectionKey;
    let target = beforeId === null ? -1 : reportDesignControls.findIndex((item) => String(item.id) === String(beforeId) && item.sectionKey === sectionKey);
    if (target < 0) target = reportDesignControls.length;
    reportDesignControls.splice(target, 0, control); invalidatePreview(); render();
  }

  function addControl(token, sectionKey = 'detail', beforeId = null) {
    if (!fieldsForDesign().some((field) => field.token === token)) return;
    const control = { id: reportDesignNextId++, kind: 'field', token, sectionKey };
    const target = beforeId === null ? -1 : reportDesignControls.findIndex((item) => String(item.id) === String(beforeId));
    if (target < 0) reportDesignControls.push(control); else reportDesignControls.splice(target, 0, control);
    invalidatePreview(); render(); feedback('Field control added to the section.');
  }

  function addLabel(text, sectionKey) {
    const value = String(text || '').trim();
    if (!value) { feedback('Enter text for the label first.', true); return; }
    if (!sections(fieldsForDesign()).some(([key]) => key === sectionKey)) { feedback('Choose an available report section for the label.', true); return; }
    reportDesignControls.push({ id: reportDesignNextId++, kind: 'label', text: value, sectionKey });
    document.querySelector('#report-design-label-text').value = '';
    invalidatePreview(); render(); feedback('Text label added to the section.');
  }

  function handleCanvasDrop(event) {
    const zone = event.target.closest('[data-report-design-dropzone]'); if (!zone) return;
    const before = event.target.closest('[data-report-design-control-id]')?.dataset.reportDesignControlId || null;
    const fieldToken = event.dataTransfer.getData('application/x-report-design-field');
    const controlId = event.dataTransfer.getData('application/x-report-design-control');
    if (fieldToken) { event.preventDefault(); addControl(fieldToken, zone.dataset.reportDesignDropzone, before); }
    else if (controlId) { event.preventDefault(); moveControl(controlId, zone.dataset.reportDesignDropzone, before); }
  }

  function handleEvents(storage) {
    document.querySelector('#report-design-form').addEventListener('submit', (event) => { event.preventDefault(); generatePreview(); });
    document.querySelector('#report-design-new').addEventListener('click', startNewReport);
    document.querySelector('#report-design-source-mode').addEventListener('change', (event) => { reportDesignSourceMode = event.target.value === 'query' ? 'query' : 'related'; queryColumnSignature = JSON.stringify(lastQueryResultSet?.columns || []) || null; invalidatePreview(); render(); });
    document.querySelector('#report-design-table').addEventListener('change', () => { invalidatePreview(); render(); });
    document.querySelector('#report-design-field-section').addEventListener('change', () => render());
    document.querySelector('#report-design-add-group').addEventListener('click', () => addLevel('group'));
    document.querySelector('#report-design-add-sort').addEventListener('click', () => addLevel('sort'));
    document.querySelector('#report-design-saved-select').addEventListener('change', (event) => {
      const has = Boolean(event.target.value); document.querySelector('#report-design-load').disabled = !has; document.querySelector('#report-design-delete').disabled = !has;
      document.querySelector('#report-design-saved-feedback').textContent = '';
    });
    document.querySelector('#report-design-save').addEventListener('click', () => saveDesign(storage).catch((error) => feedback(error.message || 'Could not save the report design.', true, true)));
    document.querySelector('#report-design-load').addEventListener('click', () => loadDesign(storage));
    document.querySelector('#report-design-delete').addEventListener('click', () => deleteDesign(storage).catch((error) => feedback(error.message || 'Could not delete the report design.', true, true)));
    document.querySelector('#report-design-fields').addEventListener('click', (event) => {
      const button = event.target.closest('[data-add-report-design-field]');
      if (button) addControl(button.dataset.addReportDesignField, document.querySelector('#report-design-field-section').value || 'detail');
    });
    document.querySelector('#report-design-add-label').addEventListener('click', () => {
      addLabel(document.querySelector('#report-design-label-text').value, document.querySelector('#report-design-label-section').value);
    });
    document.querySelector('#report-design-label-text').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') { event.preventDefault(); addLabel(event.currentTarget.value, document.querySelector('#report-design-label-section').value); }
    });
    document.querySelector('#report-design-select-all').addEventListener('click', () => {
      fieldsForDesign().forEach((field) => {
        if (!reportDesignControls.some((control) => control.token === field.token && control.sectionKey === 'detail')) {
          reportDesignControls.push({ id: reportDesignNextId++, token: field.token, sectionKey: 'detail' });
        }
      });
      invalidatePreview(); render(); feedback('All source fields added to Detail.');
    });
    document.querySelector('#report-design-select-none').addEventListener('click', () => {
      reportDesignControls = reportDesignControls.filter((control) => control.sectionKey !== 'detail');
      invalidatePreview(); render(); feedback('Detail field controls cleared.');
    });
    document.querySelector('#report-design-levels').addEventListener('click', (event) => {
      const button = event.target.closest('[data-report-design-level-action]'); if (!button) return;
      const row = button.closest('[data-report-design-level]'); const index = reportDesignLevels.findIndex((level) => level.id === row?.dataset.reportDesignLevel); if (index < 0) return;
      if (button.dataset.reportDesignLevelAction === 'remove') {
        const [removed] = reportDesignLevels.splice(index, 1);
        if (removed.type === 'group') reportDesignControls.forEach((control) => { if (control.sectionKey === `${removed.id}:header` || control.sectionKey === `${removed.id}:footer`) control.sectionKey = 'detail'; });
      }
      else { const target = index + (button.dataset.reportDesignLevelAction === 'up' ? -1 : 1); if (target < 0 || target >= reportDesignLevels.length) return; const [level] = reportDesignLevels.splice(index, 1); reportDesignLevels.splice(target, 0, level); }
      invalidatePreview(); render();
    });
    document.querySelector('#report-design-levels').addEventListener('change', (event) => {
      const row = event.target.closest('[data-report-design-level]'); if (!row) return;
      const level = reportDesignLevels.find((item) => item.id === row.dataset.reportDesignLevel); const previousType = level?.type;
      levelStateFromRow(row);
      if (level && previousType !== level.type && level.type === 'group') { level.showHeader = true; level.showFooter = true; }
      invalidatePreview(); render();
    });
    document.querySelector('#report-design-levels').addEventListener('input', (event) => {
      const row = event.target.closest('[data-report-design-level]'); if (!row) return; levelStateFromRow(row); invalidatePreview();
    });
    document.querySelector('#report-design-canvas').addEventListener('dragstart', (event) => {
      const field = event.target.closest('[data-report-design-field-token]'); const control = event.target.closest('[data-report-design-control-id]');
      if (field) event.dataTransfer.setData('application/x-report-design-field', field.dataset.reportDesignFieldToken);
      if (control) event.dataTransfer.setData('application/x-report-design-control', control.dataset.reportDesignControlId);
      event.dataTransfer.effectAllowed = 'move';
    });
    document.querySelector('#report-design-fields').addEventListener('dragstart', (event) => {
      const field = event.target.closest('[data-report-design-field-token]'); if (!field) return;
      event.dataTransfer.effectAllowed = 'copy'; event.dataTransfer.setData('application/x-report-design-field', field.dataset.reportDesignFieldToken);
    });
    const canvas = document.querySelector('#report-design-canvas');
    canvas.addEventListener('dragover', (event) => { if (event.target.closest('[data-report-design-dropzone]')) { event.preventDefault(); event.dataTransfer.dropEffect = event.dataTransfer.types.includes('application/x-report-design-control') ? 'move' : 'copy'; } });
    canvas.addEventListener('drop', handleCanvasDrop);
    canvas.addEventListener('click', (event) => {
      const action = event.target.closest('[data-report-design-control-action]'); const card = action?.closest('[data-report-design-control-id]'); if (!action || !card) return;
      const index = reportDesignControls.findIndex((item) => String(item.id) === card.dataset.reportDesignControlId); if (index < 0) return;
      if (action.dataset.reportDesignControlAction === 'remove') reportDesignControls.splice(index, 1);
      else { const section = reportDesignControls[index].sectionKey; const inSection = reportDesignControls.map((item, i) => ({ item, i })).filter(({ item }) => item.sectionKey === section); const position = inSection.findIndex(({ i }) => i === index); const target = inSection[position + (action.dataset.reportDesignControlAction === 'up' ? -1 : 1)]; if (!target) return; const [item] = reportDesignControls.splice(index, 1); reportDesignControls.splice(target.i, 0, item); }
      invalidatePreview(); render();
    });
    canvas.addEventListener('change', (event) => {
      const checkbox = event.target.closest('[data-report-design-group-label]'); if (!checkbox) return;
      const level = reportDesignLevels.find((item) => item.id === checkbox.dataset.reportDesignGroupLabel); if (!level) return;
      level.hideGroupLabel = checkbox.checked;
      invalidatePreview(); render();
    });
    document.querySelectorAll('[data-report-section]').forEach((input) => input.addEventListener('change', () => { sectionChanged(input); invalidatePreview(); }));
    document.querySelector('#report-design-show-details').addEventListener('change', () => { invalidatePreview(); });
    document.querySelector('#report-design-grand-total').addEventListener('change', () => { invalidatePreview(); render(); });
    document.querySelector('#report-design-grand-function').addEventListener('change', () => { invalidatePreview(); render(); });
    document.querySelector('#report-design-grand-field').addEventListener('change', invalidatePreview);
    document.querySelector('#report-design-title').addEventListener('input', invalidatePreview);
    document.querySelector('#report-design-view-canvas').addEventListener('click', () => setView('design'));
    document.querySelector('#report-design-view-preview').addEventListener('click', () => reportDesignPreviewReady ? setView('preview') : generatePreview());
    document.querySelector('#report-design-print').addEventListener('click', () => { if (reportDesignPreviewReady) window.print(); });
  }

  window.initializeReportDesign = async function initializeReportDesign(storage) {
    document.querySelector('#tab-report-design').addEventListener('click', () => { refreshSources(); setView(reportDesignViewMode); });
    handleEvents(storage); refreshSaved(); refreshSources();
  };
  window.refreshReportDesignCatalog = function refreshReportDesignCatalog() { refreshSaved(); };
  window.refreshReportDesignSources = function refreshReportDesignSources() { refreshSources(); };
  window.reportDesignQueryChanged = queryChanged;
  window.invalidateReportDesignPreview = invalidatePreview;
  window.restorePendingReportDesign = restorePending;
  window.resetReportDesignForDatabase = resetForDatabase;
})();
