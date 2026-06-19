// Main Blockly setup, instruction reading, and character movement.
(function () {
  const GRID_SIZE = 50;
  const MOVE_DURATION = 420;
  const PAUSE_DURATION = 500;
  const CHARACTER_WIDTH = GRID_SIZE;
  const CHARACTER_HEIGHT = GRID_SIZE;
  const WALL = '#';
  const START = 'S';
  const FINISH = 'F';

  const DEFAULT_MAZE_LAYOUT = [
    '########',
    '#S..#..#',
    '#.#.#..#',
    '#.#...##',
    '#...#.F#',
    '########'
  ];

  const MAZE_LEVELS = {
    easy: { wallChance: 0.13, minimumOpenCells: 18, label: 'Easy' },
    medium: { wallChance: 0.25, minimumOpenCells: 15, label: 'Medium' },
    hard: { wallChance: 0.38, minimumOpenCells: 12, label: 'Hard' }
  };

  const ASSETS = {
    idle: 'assets/static/walk_down.png',
    up: 'assets/static/walk_up.png',
    down: 'assets/static/walk_down.png',
    left: 'assets/static/walk_left.png',
    right: 'assets/static/walk_right.png'
  };

  let workspace;
  let position = { x: 0, y: 0 };
  let cell = { col: 1, row: 1 };
  let startCell = { col: 1, row: 1 };
  let mazeOffset = { x: 0, y: 0 };
  let mazeLayout = DEFAULT_MAZE_LAYOUT.slice();
  let currentLevel = 'easy';
  let isRunning = false;
  let isPaused = false;
  let isStopped = true;
  let animationFrameId = null;
  let finishCurrentMove = null;
  let isSandpitMode = false;
  let sandpitTool = 'wall';
  let isDraggingCharacter = false;
  let lastStageTap = { col: -1, row: -1, time: 0 };

  const stage = document.getElementById('stage');
  const mazeLayer = document.getElementById('mazeLayer');
  const ouchBubble = document.getElementById('ouchBubble');
  const character = document.getElementById('character');
  const statusText = document.getElementById('statusText');
  const runButton = document.getElementById('runButton');
  const pauseButton = document.getElementById('pauseButton');
  const stopButton = document.getElementById('stopButton');
  const resetButton = document.getElementById('resetButton');
  const newMazeButton = document.getElementById('newMazeButton');
  const sandpitButton = document.getElementById('sandpitButton');
  const sandpitTools = document.getElementById('sandpitTools');
  const toolButtons = Array.from(document.querySelectorAll('.tool-button'));
  const levelButtons = Array.from(document.querySelectorAll('.level-button'));

  window.addEventListener('load', init);

  function init() {
    workspace = Blockly.inject('blocklyDiv', {
      toolbox: document.getElementById('toolbox'),
      media: 'lib/blockly/media/',
      renderer: 'zelos',
      theme: Blockly.Themes.CreatureBlocks,
      trashcan: true,
      scrollbars: true,
      move: {
        scrollbars: true,
        drag: true,
        wheel: true
      },
      zoom: {
        controls: true,
        wheel: true,
        pinch: true,
        startScale: 1.45,
        maxScale: 2.2,
        minScale: 0.8,
        scaleSpeed: 1.15
      },
      grid: {
        spacing: 32,
        length: 3,
        colour: '#d6e4ff',
        snap: true
      }
    });

    addStarterBlocks();
    startCell = findStartCell();
    renderMaze();
    setStartPosition();
    setIdle();
    connectButtons();
    setSandpitMode(false);

    window.addEventListener('resize', handleResize);
    setTimeout(function () {
      Blockly.svgResize(workspace);
      renderMaze();
      setStartPosition();
    }, 100);
  }

  function addStarterBlocks() {
    const xmlText = '<xml><block type="when_run" x="40" y="40"></block></xml>';
    const xml = Blockly.utils.xml.textToDom(xmlText);
    Blockly.Xml.domToWorkspace(xml, workspace);
  }

  function connectButtons() {
    runButton.addEventListener('click', handleRun);
    pauseButton.addEventListener('click', handlePause);
    stopButton.addEventListener('click', function () {
      stopExecution(false);
      setStatus('Stopped');
    });
    resetButton.addEventListener('click', resetCharacter);
    newMazeButton.addEventListener('click', createRandomMaze);
    sandpitButton.addEventListener('click', toggleSandpitMode);
    stage.addEventListener('pointerup', handleStagePointerUp);
    character.addEventListener('pointerdown', startCharacterDrag);
    window.addEventListener('pointermove', moveCharacterDrag);
    window.addEventListener('pointerup', stopCharacterDrag);

    levelButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        setMazeLevel(button.dataset.level);
      });
    });

    toolButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        setSandpitTool(button.dataset.tool);
      });
    });
  }

  function handleRun() {
    if (isRunning && isPaused) {
      isPaused = false;
      updatePauseButton();
      setStatus('Running');
      return;
    }

    if (isRunning) {
      return;
    }

    setSandpitMode(false);
    hideOuch();
    updateStartTile();
    const instructions = buildInstructionList();
    if (instructions.length === 0) {
      setStatus('Add movement blocks under when run');
      return;
    }

    runInstructions(instructions);
  }

  function handlePause() {
    if (!isRunning) {
      return;
    }

    isPaused = true;
    updatePauseButton();
    setStatus('Paused');
  }

  function updatePauseButton() {
    pauseButton.textContent = isPaused ? 'Paused' : 'Pause';
  }

  function buildInstructionList() {
    const startBlock = workspace.getTopBlocks(false).find(function (block) {
      return block.type === 'when_run';
    });

    if (!startBlock) {
      return [];
    }

    return buildStackInstructions(startBlock.getNextBlock());
  }

  function buildStackInstructions(firstBlock) {
    const instructions = [];
    let block = firstBlock;

    while (block) {
      const instruction = blockToInstruction(block);
      if (instruction) {
        instructions.push(instruction);
      }
      block = block.getNextBlock();
    }

    return instructions;
  }

  function blockToInstruction(block) {
    if (block.type === 'move_up') {
      return { type: 'move', direction: 'up', steps: getDropdownNumber(block, 'STEPS') };
    }

    if (block.type === 'move_down') {
      return { type: 'move', direction: 'down', steps: getDropdownNumber(block, 'STEPS') };
    }

    if (block.type === 'move_left') {
      return { type: 'move', direction: 'left', steps: getDropdownNumber(block, 'STEPS') };
    }

    if (block.type === 'move_right') {
      return { type: 'move', direction: 'right', steps: getDropdownNumber(block, 'STEPS') };
    }

    if (block.type === 'repeat_times') {
      return {
        type: 'repeat',
        times: getDropdownNumber(block, 'TIMES'),
        instructions: buildStackInstructions(block.getInputTargetBlock('DO'))
      };
    }

    if (block.type === 'pause_action') {
      return { type: 'pause', duration: PAUSE_DURATION };
    }

    if (block.type === 'stop_action') {
      return { type: 'stop' };
    }

    return null;
  }

  function getDropdownNumber(block, fieldName) {
    const value = Number(block.getFieldValue(fieldName));

    if (!Number.isFinite(value)) {
      return 1;
    }

    return Math.min(Math.max(Math.round(value), 1), 10);
  }

  async function runInstructions(instructions) {
    isRunning = true;
    isPaused = false;
    isStopped = false;
    updatePauseButton();
    setStatus('Running');

    const completed = await executeInstructions(instructions);

    if (completed && !isStopped) {
      setIdle();
      setStatus('Done');
    }

    isRunning = false;
    isPaused = false;
    isStopped = true;
    updatePauseButton();
  }

  async function executeInstructions(instructions) {
    for (const instruction of instructions) {
      if (isStopped) {
        return false;
      }

      await waitWhilePaused();

      if (instruction.type === 'move') {
        const completed = await moveManySteps(instruction.direction, instruction.steps);
        if (!completed) {
          return false;
        }
      } else if (instruction.type === 'pause') {
        setStatus('Waiting');
        await waitWithControls(instruction.duration);
      } else if (instruction.type === 'stop') {
        stopExecution(false);
        return false;
      } else if (instruction.type === 'repeat') {
        const completed = await repeatInstructions(instruction);
        if (!completed) {
          return false;
        }
      }
    }

    return true;
  }

  async function repeatInstructions(instruction) {
    for (let count = 0; count < instruction.times; count++) {
      const completed = await executeInstructions(instruction.instructions);
      if (!completed) {
        return false;
      }
    }

    return true;
  }

  async function moveManySteps(direction, steps) {
    for (let step = 0; step < steps; step++) {
      if (isStopped) {
        return false;
      }

      await waitWhilePaused();

      const moved = await moveCharacter(direction);
      if (!moved) {
        return false;
      }
    }

    return true;
  }

  function moveCharacter(direction) {
    return new Promise(function (resolve) {
      const targetCell = getTargetCell(direction);

      if (isWallCell(targetCell)) {
        handleWallHit(direction);
        resolve(false);
        return;
      }

      const start = { x: position.x, y: position.y };
      const target = getCellPosition(targetCell);
      let elapsed = 0;
      let lastTime = null;

      character.src = ASSETS[direction];
      setStatus('Moving ' + direction);
      finishCurrentMove = resolve;

      function step(timestamp) {
        if (isStopped) {
          finishCurrentMove = null;
          resolve(false);
          return;
        }

        if (lastTime === null) {
          lastTime = timestamp;
        }

        if (!isPaused) {
          elapsed += timestamp - lastTime;
          const progress = Math.min(elapsed / MOVE_DURATION, 1);
          position.x = start.x + ((target.x - start.x) * progress);
          position.y = start.y + ((target.y - start.y) * progress);
          placeCharacter();

          if (progress >= 1) {
            position = target;
            cell = targetCell;
            placeCharacter();
            finishCurrentMove = null;
            if (isFinishCell(cell)) {
              handleFinishReached();
              resolve(false);
              return;
            }
            setIdle();
            resolve(true);
            return;
          }
        }

        lastTime = timestamp;
        animationFrameId = requestAnimationFrame(step);
      }

      animationFrameId = requestAnimationFrame(step);
    });
  }

  function getTargetCell(direction) {
    const next = { col: cell.col, row: cell.row };

    if (direction === 'up') {
      next.row -= 1;
    } else if (direction === 'down') {
      next.row += 1;
    } else if (direction === 'left') {
      next.col -= 1;
    } else if (direction === 'right') {
      next.col += 1;
    }

    return next;
  }

  function isWallCell(targetCell) {
    if (
      targetCell.row < 0 ||
      targetCell.row >= mazeLayout.length ||
      targetCell.col < 0 ||
      targetCell.col >= mazeLayout[targetCell.row].length
    ) {
      return true;
    }

    return mazeLayout[targetCell.row][targetCell.col] === WALL;
  }

  function isFinishCell(targetCell) {
    return mazeLayout[targetCell.row][targetCell.col] === FINISH;
  }

  function getCellPosition(targetCell) {
    return {
      x: mazeOffset.x + (targetCell.col * GRID_SIZE),
      y: mazeOffset.y + (targetCell.row * GRID_SIZE)
    };
  }

  function getCellFromStagePoint(clientX, clientY) {
    const stageRect = stage.getBoundingClientRect();
    const x = clientX - stageRect.left - mazeOffset.x;
    const y = clientY - stageRect.top - mazeOffset.y;

    return {
      col: Math.floor(x / GRID_SIZE),
      row: Math.floor(y / GRID_SIZE)
    };
  }

  function isInsideMaze(targetCell) {
    return (
      targetCell.row >= 0 &&
      targetCell.row < mazeLayout.length &&
      targetCell.col >= 0 &&
      targetCell.col < mazeLayout[targetCell.row].length
    );
  }

  function getMazeTile(targetCell) {
    if (!isInsideMaze(targetCell)) {
      return WALL;
    }

    return mazeLayout[targetCell.row][targetCell.col];
  }

  function isStartCell(targetCell) {
    return targetCell.col === startCell.col && targetCell.row === startCell.row;
  }

  function renderMaze() {
    mazeOffset = getMazeOffset();
    stage.style.setProperty('--maze-grid-x', mazeOffset.x + 'px');
    stage.style.setProperty('--maze-grid-y', mazeOffset.y + 'px');
    mazeLayer.innerHTML = '';

    mazeLayout.forEach(function (rowText, rowIndex) {
      rowText.split('').forEach(function (tile, colIndex) {
        if (tile === WALL) {
          const wall = document.createElement('div');
          wall.className = 'maze-wall';
          wall.style.transform = 'translate(' +
            (mazeOffset.x + (colIndex * GRID_SIZE)) + 'px, ' +
            (mazeOffset.y + (rowIndex * GRID_SIZE)) + 'px)';
          mazeLayer.appendChild(wall);
          return;
        }

        if (tile === FINISH) {
          const finish = document.createElement('div');
          finish.className = 'finish-flag';
          finish.setAttribute('aria-label', 'Finish');
          finish.style.transform = 'translate(' +
            (mazeOffset.x + (colIndex * GRID_SIZE)) + 'px, ' +
            (mazeOffset.y + (rowIndex * GRID_SIZE)) + 'px)';
          mazeLayer.appendChild(finish);
        }
      });
    });
  }

  function getMazeOffset() {
    const mazeWidth = mazeLayout[0].length * GRID_SIZE;
    const mazeHeight = mazeLayout.length * GRID_SIZE;

    return {
      x: Math.max(0, Math.floor((stage.clientWidth - mazeWidth) / 2)),
      y: Math.max(0, Math.floor((stage.clientHeight - mazeHeight) / 2))
    };
  }

  function findStartCell() {
    for (let row = 0; row < mazeLayout.length; row++) {
      const col = mazeLayout[row].indexOf(START);
      if (col !== -1) {
        return { col: col, row: row };
      }
    }

    return { col: 1, row: 1 };
  }

  function updateStartTile() {
    removeStartTile();
    setMazeTile(mazeLayout, startCell.col, startCell.row, START);
  }

  function removeStartTile() {
    for (let row = 0; row < mazeLayout.length; row++) {
      const col = mazeLayout[row].indexOf(START);
      if (col !== -1) {
        setMazeTile(mazeLayout, col, row, '.');
      }
    }
  }

  function removeFinishTile() {
    for (let row = 0; row < mazeLayout.length; row++) {
      const col = mazeLayout[row].indexOf(FINISH);
      if (col !== -1) {
        setMazeTile(mazeLayout, col, row, '.');
      }
    }
  }

  function setMazeLevel(level) {
    if (!MAZE_LEVELS[level]) {
      return;
    }

    currentLevel = level;
    levelButtons.forEach(function (button) {
      const isActive = button.dataset.level === currentLevel;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function toggleSandpitMode() {
    setSandpitMode(!isSandpitMode);

    if (isSandpitMode) {
      stopExecution(false);
      setStatus('Sandpit: place walls or flags');
    } else {
      hideOuch();
      setStatus('Ready');
    }

  }

  function setSandpitMode(enabled) {
    isSandpitMode = enabled;
    if (!isSandpitMode) {
      isDraggingCharacter = false;
      character.classList.remove('is-dragging');
      lastStageTap = { col: -1, row: -1, time: 0 };
    }
    stage.classList.toggle('is-sandpit', isSandpitMode);
    sandpitButton.classList.toggle('is-active', isSandpitMode);
    sandpitButton.setAttribute('aria-pressed', String(isSandpitMode));
    sandpitTools.hidden = !isSandpitMode;
    sandpitTools.classList.toggle('is-visible', isSandpitMode);
  }

  function setSandpitTool(tool) {
    if (tool !== 'wall' && tool !== 'flag') {
      return;
    }

    sandpitTool = tool;
    toolButtons.forEach(function (button) {
      const isActive = button.dataset.tool === sandpitTool;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
  }

  function handleStagePointerUp(event) {
    if (!isSandpitMode || isDraggingCharacter || event.target === character) {
      return;
    }

    const targetCell = getCellFromStagePoint(event.clientX, event.clientY);
    if (!isInsideMaze(targetCell)) {
      return;
    }

    const now = Date.now();
    const isDoubleTap =
      targetCell.col === lastStageTap.col &&
      targetCell.row === lastStageTap.row &&
      now - lastStageTap.time < 360;

    lastStageTap = { col: targetCell.col, row: targetCell.row, time: now };

    if (isDoubleTap) {
      eraseSandpitTile(targetCell);
      return;
    }

    placeSandpitTile(targetCell);
  }

  function placeSandpitTile(targetCell) {
    if (isStartCell(targetCell)) {
      setStatus('Move the character first');
      return;
    }

    if (getMazeTile(targetCell) === WALL || getMazeTile(targetCell) === FINISH) {
      setStatus('Double tap to erase');
      return;
    }

    if (sandpitTool === 'wall') {
      setMazeTile(mazeLayout, targetCell.col, targetCell.row, WALL);
    } else if (sandpitTool === 'flag') {
      removeFinishTile();
      setMazeTile(mazeLayout, targetCell.col, targetCell.row, FINISH);
    }

    renderMaze();
    setStatus(sandpitTool === 'wall' ? 'Wall placed' : 'Flag placed');
  }

  function eraseSandpitTile(targetCell) {
    const tile = getMazeTile(targetCell);
    if (tile !== WALL && tile !== FINISH) {
      return;
    }

    setMazeTile(mazeLayout, targetCell.col, targetCell.row, '.');
    renderMaze();
    setStatus('Tile erased');
  }

  function startCharacterDrag(event) {
    if (!isSandpitMode) {
      return;
    }

    event.preventDefault();
    isDraggingCharacter = true;
    character.classList.add('is-dragging');
    character.setPointerCapture(event.pointerId);
    moveCharacterDrag(event);
  }

  function moveCharacterDrag(event) {
    if (!isDraggingCharacter) {
      return;
    }

    const targetCell = getCellFromStagePoint(event.clientX, event.clientY);
    if (!isInsideMaze(targetCell) || getMazeTile(targetCell) === WALL || getMazeTile(targetCell) === FINISH) {
      return;
    }

    cell = { col: targetCell.col, row: targetCell.row };
    startCell = { col: targetCell.col, row: targetCell.row };
    position = getCellPosition(cell);
    placeCharacter();
    hideOuch();
    setStatus('Start moved');
  }

  function stopCharacterDrag(event) {
    if (!isDraggingCharacter) {
      return;
    }

    isDraggingCharacter = false;
    character.classList.remove('is-dragging');

    try {
      character.releasePointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture can already be released if the pointer leaves the browser.
    }

    updateStartTile();
  }

  function createRandomMaze() {
    stopExecution(true);
    mazeLayout = buildRandomMaze(currentLevel);
    startCell = findStartCell();
    renderMaze();
    setStartPosition();
    setIdle();
    setStatus(MAZE_LEVELS[currentLevel].label + ' maze');
  }

  function buildRandomMaze(level) {
    const settings = MAZE_LEVELS[level] || MAZE_LEVELS.easy;
    const fallback = {
      easy: [
        '########',
        '#S.....#',
        '#..#...#',
        '#...#..#',
        '#....F##',
        '########'
      ],
      medium: DEFAULT_MAZE_LAYOUT,
      hard: [
        '########',
        '#S#...##',
        '#...#..#',
        '###.#.##',
        '#....F##',
        '########'
      ]
    };

    for (let attempt = 0; attempt < 160; attempt++) {
      const candidate = makeMazeCandidate(settings.wallChance);
      const cleanCandidate = closeUnreachableOpenCells(candidate);

      if (countReachableOpenCells(cleanCandidate) >= settings.minimumOpenCells) {
        return addFinishToMaze(cleanCandidate);
      }
    }

    return (fallback[level] || fallback.easy).slice();
  }

  function makeMazeCandidate(wallChance) {
    const height = DEFAULT_MAZE_LAYOUT.length;
    const width = DEFAULT_MAZE_LAYOUT[0].length;
    const rows = [];

    for (let row = 0; row < height; row++) {
      let rowText = '';
      for (let col = 0; col < width; col++) {
        const isEdge = row === 0 || row === height - 1 || col === 0 || col === width - 1;
        rowText += isEdge || Math.random() < wallChance ? WALL : '.';
      }
      rows.push(rowText);
    }

    setMazeTile(rows, 1, 1, START);
    setMazeTile(rows, 2, 1, '.');
    setMazeTile(rows, 1, 2, '.');
    return rows;
  }

  function closeUnreachableOpenCells(rows) {
    const reachable = getReachableCells(rows);
    const cleanRows = rows.slice();

    for (let row = 1; row < cleanRows.length - 1; row++) {
      for (let col = 1; col < cleanRows[row].length - 1; col++) {
        const tile = cleanRows[row][col];
        if (tile !== WALL && !reachable.has(getCellKey(col, row))) {
          setMazeTile(cleanRows, col, row, WALL);
        }
      }
    }

    return cleanRows;
  }

  function countReachableOpenCells(rows) {
    return getReachableCells(rows).size;
  }

  function addFinishToMaze(rows) {
    const finishCell = findFarthestReachableCell(rows);
    const rowsWithFinish = rows.slice();

    setMazeTile(rowsWithFinish, finishCell.col, finishCell.row, FINISH);
    return rowsWithFinish;
  }

  function findFarthestReachableCell(rows) {
    const start = findStartCellInRows(rows);
    const reachable = Array.from(getReachableCells(rows));
    let farthest = { col: start.col, row: start.row };
    let farthestScore = -1;

    reachable.forEach(function (key) {
      const parts = key.split(',');
      const col = Number(parts[0]);
      const row = Number(parts[1]);
      const score = Math.abs(col - start.col) + Math.abs(row - start.row);

      if (score > farthestScore && !(col === start.col && row === start.row)) {
        farthest = { col: col, row: row };
        farthestScore = score;
      }
    });

    return farthest;
  }

  function getReachableCells(rows) {
    const start = findStartCellInRows(rows);
    const visited = new Set();
    const queue = [start];
    visited.add(getCellKey(start.col, start.row));

    while (queue.length > 0) {
      const current = queue.shift();
      [
        { col: current.col + 1, row: current.row },
        { col: current.col - 1, row: current.row },
        { col: current.col, row: current.row + 1 },
        { col: current.col, row: current.row - 1 }
      ].forEach(function (next) {
        if (
          next.row < 0 ||
          next.row >= rows.length ||
          next.col < 0 ||
          next.col >= rows[next.row].length ||
          rows[next.row][next.col] === WALL
        ) {
          return;
        }

        const key = getCellKey(next.col, next.row);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push(next);
        }
      });
    }

    return visited;
  }

  function findStartCellInRows(rows) {
    for (let row = 0; row < rows.length; row++) {
      const col = rows[row].indexOf(START);
      if (col !== -1) {
        return { col: col, row: row };
      }
    }

    return { col: 1, row: 1 };
  }

  function setMazeTile(rows, col, row, tile) {
    rows[row] = rows[row].slice(0, col) + tile + rows[row].slice(col + 1);
  }

  function getCellKey(col, row) {
    return col + ',' + row;
  }

  function placeCharacter() {
    character.style.transform = 'translate(' + position.x + 'px, ' + position.y + 'px)';
    placeOuchBubble();
  }

  function setStartPosition() {
    startCell = findStartCell();
    cell = { col: startCell.col, row: startCell.row };
    position = getCellPosition(cell);
    placeCharacter();
    hideOuch();
  }

  function setIdle() {
    character.src = ASSETS.idle;
  }

  function handleWallHit(direction) {
    character.src = ASSETS[direction];
    isStopped = true;
    isPaused = false;
    setStatus('Ouch! Wall hit');
    showMessage('Ouch!', false);
    updatePauseButton();
  }

  function handleFinishReached() {
    isStopped = true;
    isPaused = false;
    setIdle();
    setStatus('Great work!');
    showMessage('Great work!', true);
    updatePauseButton();
  }

  function showMessage(message, isSuccess) {
    ouchBubble.textContent = message;
    ouchBubble.classList.toggle('is-success', isSuccess);
    placeOuchBubble();
    ouchBubble.classList.add('is-visible');
  }

  function hideOuch() {
    ouchBubble.classList.remove('is-visible');
    ouchBubble.classList.remove('is-success');
    ouchBubble.textContent = 'Ouch!';
  }

  function placeOuchBubble() {
    const bubbleX = position.x + (CHARACTER_WIDTH / 2) - (ouchBubble.offsetWidth / 2);
    const bubbleY = Math.max(4, position.y - 42);

    ouchBubble.style.left = bubbleX + 'px';
    ouchBubble.style.top = bubbleY + 'px';
  }

  function stopExecution(resetToStart) {
    isStopped = true;
    isPaused = false;

    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    if (finishCurrentMove) {
      const finish = finishCurrentMove;
      finishCurrentMove = null;
      finish(false);
    }

    if (resetToStart) {
      cell = { col: startCell.col, row: startCell.row };
      position = getCellPosition(cell);
      placeCharacter();
    }

    hideOuch();
    setIdle();
    updatePauseButton();
  }

  function resetCharacter() {
    stopExecution(true);
    setStatus('Reset');
  }

  function handleResize() {
    Blockly.svgResize(workspace);
    renderMaze();
    position = getCellPosition(cell);
    placeCharacter();
  }

  function waitWhilePaused() {
    return new Promise(function (resolve) {
      function check() {
        if (!isPaused || isStopped) {
          resolve();
          return;
        }
        setTimeout(check, 80);
      }
      check();
    });
  }

  async function waitWithControls(duration) {
    let waited = 0;

    while (waited < duration && !isStopped) {
      await waitWhilePaused();
      if (isStopped) {
        return;
      }
      await sleep(50);
      waited += 50;
    }
  }

  function sleep(milliseconds) {
    return new Promise(function (resolve) {
      setTimeout(resolve, milliseconds);
    });
  }

  function setStatus(message) {
    statusText.textContent = message;
  }
}());
