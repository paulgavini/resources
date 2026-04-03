function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

const templates = [
  {
    id: "reaction-temperature",
    name: "Effect of temperature on reaction rate",
    description: "Investigate how temperature changes reaction speed.",
    data: {
      setup: {
        title: "Effect of temperature on reaction rate",
        subject: "Science",
        yearLevel: "Year 10",
        teacher: "",
        className: "",
        dueDate: "",
        investigationType: "Fair test",
      },
      question: {
        text: "How does temperature of hydrochloric acid affect the rate of reaction with magnesium ribbon?",
      },
      hypothesis: {
        statement:
          "I predict that increasing the acid temperature will increase the reaction rate.",
        reasoning:
          "At higher temperatures, particles have more kinetic energy and collide more often with enough energy for successful reactions.",
      },
      variables: {
        independent: "Temperature of hydrochloric acid (deg C)",
        dependent: "Time taken for magnesium to fully react (seconds)",
        controlled: [
          {
            name: "Acid concentration",
            reason: "Concentration affects collision frequency and rate.",
            controlMethod: "Use 1.0 mol/L acid for every trial.",
          },
          {
            name: "Length/mass of magnesium ribbon",
            reason: "More magnesium changes reaction duration.",
            controlMethod: "Use equal 3 cm strips each trial.",
          },
          {
            name: "Acid volume",
            reason: "Different volumes alter particle number.",
            controlMethod: "Measure 20 mL each run.",
          },
        ],
      },
      risks: [
        {
          hazard: "Hydrochloric acid splashes",
          risk: "Skin or eye irritation",
          precaution: "Wear goggles and gloves; rinse spills immediately.",
        },
        {
          hazard: "Hot water bath",
          risk: "Burns",
          precaution: "Use tongs and heatproof gloves when handling hot glassware.",
        },
      ],
      materials: [
        { item: "Hydrochloric acid", quantity: "100", unit: "mL" },
        { item: "Magnesium ribbon", quantity: "1", unit: "roll" },
        { item: "Test tubes", quantity: "5", unit: "" },
        { item: "Thermometer", quantity: "1", unit: "" },
        { item: "Stopwatch", quantity: "1", unit: "" },
      ],
      method: {
        steps: [
          "Measure 20 mL of hydrochloric acid into a test tube.",
          "Adjust acid temperature using a water bath to the target temperature.",
          "Add a 3 cm magnesium strip and start the stopwatch immediately.",
          "Record the time taken until bubbling stops.",
          "Repeat for each temperature and run at least three trials.",
        ],
      },
      data: {
        columns: [
          { name: "Temperature", unit: "deg C" },
          { name: "Trial 1", unit: "s" },
          { name: "Trial 2", unit: "s" },
          { name: "Trial 3", unit: "s" },
        ],
        rowCount: 5,
        rows: [
          ["20", "52", "50", "51"],
          ["30", "41", "39", "40"],
          ["40", "31", "32", "30"],
          ["50", "25", "24", "23"],
          ["60", "19", "20", "18"],
        ],
        includeAverage: true,
      },
      analysis: {
        graphs: [
          {
            graphType: "line",
            trendlineType: "none",
            xColumn: 0,
            yColumns: [4],
          },
        ],
        trend: "As temperature increased, reaction time decreased, showing a faster reaction rate.",
        anomalies: "The value at 40 deg C trial 2 was slightly higher than nearby values.",
        hypothesisSupported: "Yes",
      },
    },
  },
  {
    id: "friction-surfaces",
    name: "Friction on different surfaces",
    description: "Compare friction force across common surfaces.",
    data: {
      setup: {
        title: "Friction on different surfaces",
        subject: "Science",
        yearLevel: "Year 8",
        teacher: "",
        className: "",
        dueDate: "",
        investigationType: "Comparison test",
      },
      question: {
        text: "How does surface type affect the force needed to move a wooden block?",
      },
      hypothesis: {
        statement:
          "I predict rough surfaces will require a greater pulling force than smooth surfaces.",
        reasoning:
          "Rougher surfaces create more interlocking irregularities, increasing friction.",
      },
      variables: {
        independent: "Surface type",
        dependent: "Force required to move block (N)",
        controlled: [
          {
            name: "Mass of block",
            reason: "Weight changes normal force and friction.",
            controlMethod: "Use the same wooden block each trial.",
          },
          {
            name: "Pulling speed",
            reason: "Speed changes measured force pattern.",
            controlMethod: "Pull steadily at a similar rate each trial.",
          },
        ],
      },
      risks: [
        {
          hazard: "Tripping over equipment",
          risk: "Minor injury",
          precaution: "Keep test area clear and cords tidy.",
        },
      ],
      materials: [
        { item: "Wooden block", quantity: "1", unit: "" },
        { item: "Spring scale", quantity: "1", unit: "" },
        { item: "Sandpaper", quantity: "1", unit: "sheet" },
        { item: "Cloth", quantity: "1", unit: "piece" },
        { item: "Smooth plastic", quantity: "1", unit: "sheet" },
      ],
      method: {
        steps: [
          "Place the first surface on a flat bench.",
          "Attach spring scale to wooden block.",
          "Pull horizontally until the block moves steadily.",
          "Record the force reading.",
          "Repeat three trials for each surface and calculate averages.",
        ],
      },
      data: {
        columns: [
          { name: "Surface", unit: "" },
          { name: "Trial 1", unit: "N" },
          { name: "Trial 2", unit: "N" },
          { name: "Trial 3", unit: "N" },
        ],
        rowCount: 4,
        rows: [
          ["Smooth plastic", "1.8", "1.7", "1.8"],
          ["Wood", "2.4", "2.3", "2.5"],
          ["Cloth", "2.9", "3.0", "2.8"],
          ["Sandpaper", "3.6", "3.5", "3.7"],
        ],
        includeAverage: true,
      },
      analysis: {
        graphs: [
          {
            graphType: "bar",
            trendlineType: "none",
            xColumn: 0,
            yColumns: [4],
          },
        ],
        trend: "Average force increased from smooth to rough surfaces.",
        anomalies: "No major anomalies were observed.",
        hypothesisSupported: "Yes",
      },
    },
  },
  {
    id: "cooling-rate",
    name: "Cooling rate investigation",
    description: "Track temperature change over time as a liquid cools.",
    data: {
      setup: {
        title: "Cooling rate investigation",
        subject: "Science",
        yearLevel: "Year 9",
        teacher: "",
        className: "",
        dueDate: "",
        investigationType: "Fair test",
      },
      question: {
        text: "How does time affect the temperature of hot water as it cools in a beaker?",
      },
      hypothesis: {
        statement:
          "I predict temperature will decrease quickly at first, then more slowly over time.",
        reasoning:
          "The temperature difference between water and surroundings is largest initially, increasing heat loss rate.",
      },
      variables: {
        independent: "Time (minutes)",
        dependent: "Water temperature (deg C)",
        controlled: [
          {
            name: "Starting water volume",
            reason: "Volume affects thermal mass.",
            controlMethod: "Use 200 mL each run.",
          },
          {
            name: "Container type",
            reason: "Different materials lose heat differently.",
            controlMethod: "Use the same glass beaker for all readings.",
          },
          {
            name: "Room conditions",
            reason: "Airflow and temperature affect cooling.",
            controlMethod: "Measure in the same location away from fans.",
          },
        ],
      },
      risks: [
        {
          hazard: "Hot water",
          risk: "Scalding",
          precaution: "Use heatproof gloves and handle carefully.",
        },
      ],
      materials: [
        { item: "Beaker", quantity: "1", unit: "" },
        { item: "Hot water", quantity: "200", unit: "mL" },
        { item: "Thermometer", quantity: "1", unit: "" },
        { item: "Stopwatch", quantity: "1", unit: "" },
      ],
      method: {
        steps: [
          "Pour 200 mL hot water into a beaker and record start temperature.",
          "Start the stopwatch.",
          "Record temperature every minute for 10 minutes.",
          "Repeat the full run for at least two more trials.",
        ],
      },
      data: {
        columns: [
          { name: "Time", unit: "min" },
          { name: "Trial 1", unit: "deg C" },
          { name: "Trial 2", unit: "deg C" },
          { name: "Trial 3", unit: "deg C" },
        ],
        rowCount: 6,
        rows: [
          ["0", "82", "81", "82"],
          ["2", "75", "74", "75"],
          ["4", "69", "68", "68"],
          ["6", "64", "63", "63"],
          ["8", "60", "59", "59"],
          ["10", "57", "56", "56"],
        ],
        includeAverage: true,
      },
      analysis: {
        graphs: [
          {
            graphType: "line",
            trendlineType: "none",
            xColumn: 0,
            yColumns: [4],
          },
        ],
        trend: "Temperature dropped over time, with a steeper drop early in the investigation.",
        anomalies: "Minute 4 in trial 2 was slightly lower than the overall pattern.",
        hypothesisSupported: "Yes",
      },
    },
  },
];

export function getTemplateList() {
  return templates.map(({ id, name, description }) => ({ id, name, description }));
}

export function getTemplateById(id) {
  const found = templates.find((template) => template.id === id);
  return found ? clone(found.data) : null;
}
