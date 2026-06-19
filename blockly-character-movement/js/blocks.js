// Custom movement blocks for the classroom creature activity.
(function () {
  const movementStyle = {
    colourPrimary: '#2563eb',
    colourSecondary: '#8bb7ff',
    colourTertiary: '#173f98'
  };

  const eventStyle = {
    colourPrimary: '#f97316',
    colourSecondary: '#ffc18a',
    colourTertiary: '#a74207'
  };

  const controlStyle = {
    colourPrimary: '#0f766e',
    colourSecondary: '#74d6ce',
    colourTertiary: '#084b45'
  };

  const stopStyle = {
    colourPrimary: '#dc2626',
    colourSecondary: '#ff9c9c',
    colourTertiary: '#8d1414'
  };

  function makeStepsField() {
    return {
      type: 'field_dropdown',
      name: 'STEPS',
      options: [
        ['1', '1'],
        ['2', '2'],
        ['3', '3'],
        ['4', '4'],
        ['5', '5'],
        ['6', '6'],
        ['7', '7'],
        ['8', '8'],
        ['9', '9'],
        ['10', '10']
      ]
    };
  }

  function makeRepeatField() {
    return {
      type: 'field_dropdown',
      name: 'TIMES',
      options: [
        ['1', '1'],
        ['2', '2'],
        ['3', '3'],
        ['4', '4'],
        ['5', '5'],
        ['6', '6'],
        ['7', '7'],
        ['8', '8'],
        ['9', '9'],
        ['10', '10']
      ]
    };
  }

  Blockly.Themes.CreatureBlocks = Blockly.Theme.defineTheme('creatureBlocks', {
    base: Blockly.Themes.Classic,
    blockStyles: {
      event_blocks: eventStyle,
      movement_blocks: movementStyle,
      control_blocks: controlStyle,
      stop_blocks: stopStyle
    },
    componentStyles: {
      workspaceBackgroundColour: '#f8fbff',
      toolboxBackgroundColour: '#e9f2ff',
      toolboxForegroundColour: '#182033',
      flyoutBackgroundColour: '#ffffff',
      flyoutForegroundColour: '#182033',
      flyoutOpacity: 1,
      scrollbarColour: '#7aa8ff',
      insertionMarkerColour: '#ffd84d',
      insertionMarkerOpacity: 0.5
    },
    fontStyle: {
      family: 'Arial, Helvetica, sans-serif',
      size: 18,
      weight: 'bold'
    },
    startHats: true
  });

  Blockly.common.defineBlocksWithJsonArray([
    {
      type: 'when_run',
      message0: 'when run ▶',
      nextStatement: null,
      style: 'event_blocks',
      tooltip: 'Start here when Run is pressed.',
      helpUrl: ''
    },
    {
      type: 'move_up',
      message0: 'move up %1 ↑',
      args0: [makeStepsField()],
      previousStatement: null,
      nextStatement: null,
      style: 'movement_blocks',
      tooltip: 'Move up by this many squares.',
      helpUrl: ''
    },
    {
      type: 'move_down',
      message0: 'move down %1 ↓',
      args0: [makeStepsField()],
      previousStatement: null,
      nextStatement: null,
      style: 'movement_blocks',
      tooltip: 'Move down by this many squares.',
      helpUrl: ''
    },
    {
      type: 'move_left',
      message0: 'move left %1 ←',
      args0: [makeStepsField()],
      previousStatement: null,
      nextStatement: null,
      style: 'movement_blocks',
      tooltip: 'Move left by this many squares.',
      helpUrl: ''
    },
    {
      type: 'move_right',
      message0: 'move right %1 →',
      args0: [makeStepsField()],
      previousStatement: null,
      nextStatement: null,
      style: 'movement_blocks',
      tooltip: 'Move right by this many squares.',
      helpUrl: ''
    },
    {
      type: 'repeat_times',
      message0: 'repeat %1 times',
      args0: [makeRepeatField()],
      message1: 'do %1',
      args1: [
        {
          type: 'input_statement',
          name: 'DO'
        }
      ],
      previousStatement: null,
      nextStatement: null,
      style: 'control_blocks',
      tooltip: 'Repeat the blocks inside this many times.',
      helpUrl: ''
    },
    {
      type: 'pause_action',
      message0: 'pause ⏸',
      previousStatement: null,
      nextStatement: null,
      style: 'control_blocks',
      tooltip: 'Wait for a short moment.',
      helpUrl: ''
    },
    {
      type: 'stop_action',
      message0: 'stop ■',
      previousStatement: null,
      nextStatement: null,
      style: 'stop_blocks',
      tooltip: 'Stop the program.',
      helpUrl: ''
    }
  ]);
}());
