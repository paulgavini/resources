function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

const templates = [
  {
    id: "mobile-plan-comparison",
    name: "Mobile plan comparison",
    description: "Compare three mobile plans with linear cost models.",
    data: {
      setup: {
        title: "Comparing mobile plan costs with linear models",
        subject: "Mathematics",
        yearLevel: "Year 10",
        teacher: "",
        className: "",
        dueDate: "",
        taskType: "Modelling",
        problemFocus: "Determine which mobile plan is the best value for different monthly data usage levels.",
      },
      introduction: {
        hook: "Choosing the wrong mobile plan can turn a small monthly fee into a much larger yearly cost.",
        problemContext:
          "This investigation will compare three mobile plans by examining how their total monthly costs change as data usage increases.",
        fieldOfMathematics: "Linear relationships",
        fieldDescription:
          "Linear relationships describe quantities that change at a constant rate and can be represented with equations, tables, and graphs.",
        connection:
          "By modelling each plan with a linear rule and graphing the results, the most cost-effective option can be identified at different usage levels.",
      },
      investigation: {
        cycles: [
          {
            heading: "Defining the three linear rules",
            introduce:
              "The monthly cost for each plan is represented with a fixed fee plus a variable amount that depends on the number of gigabytes used.",
            workings:
              "Plan A: Cost = 22 + 1.20g\nPlan B: Cost = 30 + 0.85g\nPlan C: Cost = 38 + 0.45g",
            explanation:
              "These equations show that Plan A starts cheapest but increases fastest, while Plan C starts highest but has the smallest rate of increase.",
          },
          {
            heading: "Comparing the plans in a table and graph",
            introduce:
              "Selected usage values are substituted into each rule so the costs can be compared directly and then displayed graphically.",
            workings:
              "Substitute g = 0, 5, 10, 15, 20, 25 into each rule and record the costs in the table below.",
            explanation:
              "The resulting table and graph reveal where the plans are close in value and where one option becomes clearly cheaper than the others.",
          },
        ],
      },
      data: {
        columns: [
          { name: "Data usage", unit: "GB" },
          { name: "Plan A cost", unit: "$" },
          { name: "Plan B cost", unit: "$" },
          { name: "Plan C cost", unit: "$" },
        ],
        rowCount: 6,
        rows: [
          ["0", "22", "30", "38"],
          ["5", "28", "34.25", "40.25"],
          ["10", "34", "38.5", "42.5"],
          ["15", "40", "42.75", "44.75"],
          ["20", "46", "47", "47"],
          ["25", "52", "51.25", "49.25"],
        ],
        includeAverage: false,
        includeStandardDeviation: false,
      },
      graphs: {
        cards: [
          {
            graphType: "line",
            trendlineType: "none",
            xColumn: 0,
            yColumns: [1, 2, 3],
            startAtOrigin: true,
          },
        ],
        commentary:
          "The graph shows Plan A as the cheapest at low usage, but Plan C becomes the best-value option once the usage level is high enough.",
      },
      analysis: {
        patternOfResults:
          "The cost of each plan increased linearly as data usage increased. Plan A had the smallest starting fee but the steepest gradient, while Plan C had the greatest starting fee and the flattest gradient.",
        writtenEvidence:
          "At 0 GB, Plan A cost $22 while Plan C cost $38. At 25 GB, Plan A cost $52 while Plan C cost $49.25, showing that the cheapest plan changed as usage increased.",
        assumptions:
          "The models assumed the pricing structures stayed fixed and did not include promotional discounts, excess data penalties, or contract conditions that could change the total cost.",
        reasonableness:
          "The solution was reasonable because the data followed the structure of the pricing rules closely and the intersection points matched the visual change in the graph.",
        methodComparison:
          "The table and the graph both led to the same conclusion. The graph made the crossover points easier to identify, while the table provided exact costs at selected usage levels.",
        strengths: [
          {
            factor: "Using linear equations for each plan",
            impact:
              "This strengthened the method because the pricing structure of a fixed fee plus a cost per gigabyte was represented clearly and consistently.",
          },
        ],
        limitations: [
          {
            factor: "Ignoring real-world contract conditions",
            impact:
              "This limited the investigation because actual plan value can depend on promotional periods, caps, or inclusions that were not represented in the model.",
          },
        ],
        improvements: [
          {
            improvement: "Include actual plan fine print and excess-data charges",
            benefit:
              "This would make the investigation more realistic by matching the mathematical model more closely to how real plans behave in practice.",
          },
        ],
      },
      conclusion: {
        relationBack:
          "Linear relationships were used to model how the monthly cost of each phone plan changed as data usage increased.",
        majorFindings:
          "The analysis showed that the cheapest option depended on the amount of data used, because each plan had a different starting value and gradient.",
        solutionStatement:
          "The problem was solved by identifying Plan A as best for low usage and Plan C as best for higher usage, with the graph highlighting where the change occurred.",
      },
    },
  },
  {
    id: "flooring-costs",
    name: "Flooring cost investigation",
    description: "Use geometry and financial maths to compare flooring options.",
    data: {
      setup: {
        title: "Comparing flooring costs for a rectangular room",
        subject: "Mathematics",
        yearLevel: "Year 9",
        teacher: "",
        className: "",
        dueDate: "",
        taskType: "Problem solving",
        problemFocus: "Determine the total flooring cost for several options and identify the most economical choice.",
      },
      introduction: {
        hook: "Home renovation decisions often depend on whether the cheapest quoted price is really the cheapest final option.",
        problemContext:
          "This investigation will determine the area of a room and use that result to compare the total costs of several flooring choices.",
        fieldOfMathematics: "Geometry and financial mathematics",
        fieldDescription:
          "Geometry is used to calculate measurements such as area, while financial mathematics compares costs, rates, and totals.",
        connection:
          "By finding the area of the room first and then applying each flooring rate, the investigation can identify the most economical flooring option.",
      },
      investigation: {
        cycles: [
          {
            heading: "Calculating the room area",
            introduce:
              "The floor area must be found before any flooring costs can be compared.",
            workings:
              "Length = 4.8 m\nWidth = 3.6 m\nArea = length x width\nArea = 4.8 x 3.6\nArea = 17.28 m²",
            explanation:
              "The room area is 17.28 square metres, so each flooring quote must cover this amount of floor space.",
          },
          {
            heading: "Calculating the total cost for each option",
            introduce:
              "Each flooring option is priced per square metre, so the area is multiplied by the given rate.",
            workings:
              "Vinyl: 17.28 x 28 = $483.84\nLaminate: 17.28 x 34 = $587.52\nCarpet: 17.28 x 31 = $535.68",
            explanation:
              "The calculations show that vinyl has the lowest total cost, followed by carpet, then laminate.",
          },
        ],
      },
      data: {
        columns: [
          { name: "Flooring option", unit: "" },
          { name: "Rate", unit: "$/m²" },
          { name: "Total cost", unit: "$" },
        ],
        rowCount: 3,
        rows: [
          ["Vinyl", "28", "483.84"],
          ["Laminate", "34", "587.52"],
          ["Carpet", "31", "535.68"],
        ],
        includeAverage: false,
        includeStandardDeviation: false,
      },
      graphs: {
        cards: [
          {
            graphType: "bar",
            trendlineType: "none",
            xColumn: 0,
            yColumns: [2],
            startAtOrigin: true,
          },
        ],
        commentary:
          "The bar graph makes the price difference between the three flooring options easy to compare at a glance.",
      },
      analysis: {
        patternOfResults:
          "The flooring costs were directly linked to the price per square metre because the same room area was used in every calculation.",
        writtenEvidence:
          "Vinyl cost $483.84, carpet cost $535.68, and laminate cost $587.52. This showed that vinyl was the cheapest total option.",
        assumptions:
          "The investigation assumed no wastage, no installation fee, and no extra charges for trims or underlay.",
        reasonableness:
          "The solution was reasonable for a first estimate because it applied correct area and rate calculations, but the final real-world cost would likely be slightly higher.",
        methodComparison:
          "The written calculations and the bar graph supported the same conclusion. The calculations showed the exact totals, while the graph made the price ranking more visible.",
        strengths: [
          {
            factor: "Using exact room dimensions in the area calculation",
            impact:
              "This strengthened the investigation because every later cost calculation was based on a measured geometric value rather than an estimate.",
          },
        ],
        limitations: [
          {
            factor: "Not including installation and wastage",
            impact:
              "This limited the investigation because real flooring projects usually require extra material and labour costs.",
          },
        ],
        improvements: [
          {
            improvement: "Add a wastage percentage and labour quote to the model",
            benefit:
              "This would improve the accuracy of the comparison by making the final totals closer to real renovation costs.",
          },
        ],
      },
      conclusion: {
        relationBack:
          "Geometry was used to calculate the room area and financial mathematics was used to compare the total costs of each flooring option.",
        majorFindings:
          "The analysis showed that the same area produced different final totals because each flooring option had a different rate per square metre.",
        solutionStatement:
          "The problem was solved by showing that vinyl was the cheapest option for this room, based on the calculated total costs.",
      },
    },
  },
  {
    id: "water-tank-volume",
    name: "Water tank volume investigation",
    description: "Model the relationship between water height and volume in a cylinder.",
    data: {
      setup: {
        title: "Investigating water volume in a cylindrical tank",
        subject: "Mathematics",
        yearLevel: "Year 11",
        teacher: "",
        className: "",
        dueDate: "",
        taskType: "Modelling",
        problemFocus: "Determine how the volume of water changes as the height in a cylindrical tank increases.",
      },
      introduction: {
        hook: "Storage capacity is easier to manage when the height of water in a tank can be converted quickly into volume.",
        problemContext:
          "This investigation will model the relationship between water height and the volume contained in a cylindrical tank.",
        fieldOfMathematics: "Measurement and algebraic modelling",
        fieldDescription:
          "Measurement formulas describe quantities such as radius, area, and volume, while algebraic modelling represents relationships between variables.",
        connection:
          "By using the cylinder volume formula and varying the water height, the investigation can predict how much water the tank contains at different levels.",
      },
      investigation: {
        cycles: [
          {
            heading: "Forming the cylinder volume rule",
            introduce:
              "The volume of water in the tank depends on the area of the circular base and the height of the water.",
            workings:
              "Radius = 0.75 m\nBase area = πr² = π(0.75)² ≈ 1.767 m²\nVolume = base area x height\nV ≈ 1.767h",
            explanation:
              "The model shows that volume changes at a constant rate because the base area of the cylinder remains fixed.",
          },
          {
            heading: "Substituting sample heights into the model",
            introduce:
              "Several water heights are substituted into the model to generate a table and graph.",
            workings:
              "At h = 0.5 m, V ≈ 0.8835 m³\nAt h = 1.0 m, V ≈ 1.767 m³\nAt h = 1.5 m, V ≈ 2.6505 m³",
            explanation:
              "Each increase of 0.5 m adds the same amount of volume because the tank cross-section is constant throughout.",
          },
        ],
      },
      data: {
        columns: [
          { name: "Water height", unit: "m" },
          { name: "Volume", unit: "m³" },
        ],
        rowCount: 6,
        rows: [
          ["0.0", "0.000"],
          ["0.5", "0.884"],
          ["1.0", "1.767"],
          ["1.5", "2.651"],
          ["2.0", "3.534"],
          ["2.5", "4.418"],
        ],
        includeAverage: false,
        includeStandardDeviation: false,
      },
      graphs: {
        cards: [
          {
            graphType: "line",
            trendlineType: "linear",
            xColumn: 0,
            yColumns: [1],
            startAtOrigin: true,
          },
        ],
        commentary:
          "The graph shows a straight-line relationship because the volume changes at a constant rate for each equal increase in water height.",
      },
      analysis: {
        patternOfResults:
          "The data produced a straight-line pattern, showing that volume increased proportionally with water height in the cylindrical tank.",
        writtenEvidence:
          "When the height doubled from 0.5 m to 1.0 m, the volume also doubled from about 0.884 m³ to 1.767 m³, supporting the linear model.",
        assumptions:
          "The model assumed the tank was a perfect cylinder, the internal radius stayed constant, and measurement error was negligible.",
        reasonableness:
          "The solution was reasonable because the formula for cylinder volume matched the geometry of the tank and the graph reflected a constant rate of change.",
        methodComparison:
          "The algebraic rule, table, and graph all supported the same conclusion. The rule gave the general relationship, while the table and graph illustrated it numerically and visually.",
        strengths: [
          {
            factor: "Using a standard geometric formula",
            impact:
              "This strengthened the investigation because the model was built from an accepted relationship for cylindrical volume.",
          },
        ],
        limitations: [
          {
            factor: "Rounding the calculated volumes",
            impact:
              "This limited the investigation because rounding reduced the precision of the displayed values.",
          },
        ],
        improvements: [
          {
            improvement: "Use more decimal places and more sample heights",
            benefit:
              "This would improve the model by showing the linear relationship with greater precision and more detail.",
          },
        ],
      },
      conclusion: {
        relationBack:
          "Measurement and algebraic modelling were used together to connect water height to volume in a cylindrical tank.",
        majorFindings:
          "The analysis showed a constant rate of increase, confirming that the volume-height relationship in this tank was linear.",
        solutionStatement:
          "The problem was solved by producing the rule V ≈ 1.767h and using it to predict the volume at different water heights.",
      },
    },
  },
];

export function getTemplateList() {
  return templates.map(({ id, name, description }) => ({ id, name, description }));
}

export function getTemplateById(templateId) {
  const template = templates.find((entry) => entry.id === templateId);
  return template ? clone(template.data) : null;
}
