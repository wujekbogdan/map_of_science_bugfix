import * as d3 from "d3";

let data = [];
let concepts = {};
let quadtree = null;
const xScaleOriginal = d3.scaleLinear();
const yScaleOriginal = d3.scaleLinear();
let xScale = xScaleOriginal.copy();
let yScale = yScaleOriginal.copy();

function parseKeyConceptsRaw(keyConceptsRaw) {
  return keyConceptsRaw.split(",");
}

function parseConceptItem(item) {
  concepts[item["index"]] = item["key"];
}

function handleConceptsLoaded(conceptData) {
  console.log("Concepts Loaded");
  //   concepts = conceptData;
}

function parseDataPointItem(item) {
  return {
    clusterId: Number(item["cluster_id"]),
    x: Number(item["x"]),
    y: Number(item["y"]),
    numRecentArticles: Number(item["num_recent_articles"]),
    growthRating: Number(item["growth_rating"]),
    clusterCategoryId: Number(item["cluster_category"]),
    keyConcepts: parseKeyConceptsRaw(item["key_concepts"]),
  };
}

function handleDataPointsLoaded(dataPoints) {
  console.log("Data Points Loaded");

  // Sort data by num_recent_articles
  dataPoints.sort((a, b) => b.numRecentArticles - a.numRecentArticles);

  // Create a spatial index for rapidly finding the closest data point
  quadtree = buildQuadtree(dataPoints);

  initChart(dataPoints);
}

function buildQuadtree(dataPoints) {
  const quadtree = d3
    .quadtree()
    .x((d) => d.x)
    .y((d) => d.y)
    .addAll(dataPoints);
  return quadtree;
}

function buildLoaderWorker() {
  return new Worker(new URL("./streaming-tsv-parser.js", import.meta.url).href);
}

function handleLoaderWorkerMessage(
  { data: { items, totalBytes, finished } },
  parseItem,
  dataTarget,
  onLoaded
) {
  const rows = items.map(parseItem);

  dataTarget.push(...rows);

  if (finished) {
    onLoaded(dataTarget);
  }
}

function runLoaderWorker(loaderWorker, url) {
  loaderWorker.postMessage(url.href);
}

function loadData(url, parseItem, dataTarget, onLoaded) {
  const loaderWorker = buildLoaderWorker();
  loaderWorker.onmessage = (d) =>
    handleLoaderWorkerMessage(d, parseItem, dataTarget, onLoaded);
  runLoaderWorker(loaderWorker, url);
}

function loadDataPoints() {
  loadData(
    new URL("./processed1_data.tsv", import.meta.url),
    parseDataPointItem,
    data, // Separate array for data points
    handleDataPointsLoaded
  );
}

function loadConcepts() {
  loadData(
    new URL("./processed0_keys.tsv", import.meta.url),
    parseConceptItem,
    [], // We don't need to store the concepts in an array, they go to the `concepts` object
    handleConceptsLoaded
  );
}

function enableLoadingScreen() {
  document.getElementById("loading").style.display = "block";
  document.getElementById("chart").style.display = "none";
}

function enableChartScreen() {
  document.getElementById("loading").style.display = "none";
  document.getElementById("chart").style.display = "block";
}

function initChart(dataPoints) {
  enableChartScreen();
  console.log("Data Points", dataPoints);

  initScales();
  //   transformLocalScaleDomains(d3.zoomIdentity);
}

function initScales() {
  const { width, height } = getDimensions();
  xScaleOriginal.range([0, width]);
  yScaleOriginal.range([height, 0]);
  xScaleOriginal.domain([-100, 100]);
  yScaleOriginal.domain([-100, 100]);

  xScale = xScaleOriginal.copy();
  yScale = yScaleOriginal.copy();
}

// ---------------------------------
// enableLoadingScreen();
// loadConcepts();
// loadDataPoints();
data = generateRandomData(1000);
initChart(data);
// ---------------------------------

function getDimensions() {
  const chart = document.getElementById("chart-d3");
  const width = chart.clientWidth;
  const height = chart.clientHeight;
  return { width, height };
}

// Create the SVG element with initial size
const svg = d3
  .select("#chart-d3")
  .append("svg")
  .attr("width", getDimensions()[0])
  .attr("height", getDimensions()[1])
  //   .attr("preserveAspectRatio", "xMinYMin meet")
  .call(
    d3
      .zoom()
      .scaleExtent([0.5, 20]) // Zoom scale limits
      .on("zoom", zoomed)
  )
  .append("g");

// Create a group for all plot elements
const plotGroup = svg.append("g");

// Function to generate random data points
function generateRandomData(numPoints) {
  return Array.from({ length: numPoints }, () => ({
    x: Math.random() * 100,
    y: Math.random() * 100,
  }));
}

// Initial render of the scatterplot
function renderScatterPlot(data) {
  const circles = plotGroup.selectAll("circle").data(data);

  // ENTER phase for new data points
  circles
    .enter()
    .append("circle")
    .attr("cx", (d) => xScale(d.x))
    .attr("cy", (d) => yScale(d.y))
    .attr("r", 5)
    .style("fill", "steelblue");

  // UPDATE phase for existing data points
  circles.attr("cx", (d) => xScale(d.x)).attr("cy", (d) => yScale(d.y));

  // EXIT phase for removed data points
  circles.exit().remove();
}

// Initial rendering of the scatterplot
renderScatterPlot(data);

// Define the zoom function
function zoomed(event) {
  // Apply zoom transform to the scatterplot points
  const newXScale = event.transform.rescaleX(xScale);
  const newYScale = event.transform.rescaleY(yScale);

  // Update points
  plotGroup
    .selectAll("circle")
    .attr("cx", (d) => newXScale(d.x))
    .attr("cy", (d) => newYScale(d.y));
}

// Handle window resizing
window.addEventListener("resize", () => {
  const dimensions = updateDimensions();
  width = dimensions.width;
  height = dimensions.height;

  // Update the SVG dimensions and scales
  d3.select("svg").attr("width", width).attr("height", height);

  xScale.range([0, width]);
  yScale.range([height, 0]);

  // Update the position of circles based on new scale
  plotGroup
    .selectAll("circle")
    .attr("cx", (d) => xScale(d.x))
    .attr("cy", (d) => yScale(d.y));
});

// Function to update the data on button click
// document.getElementById("updateData").addEventListener("click", () => {
//   // Generate new random data
//   data = generateRandomData(1000);

//   // Re-render the scatterplot with new data
//   renderScatterPlot(data);
// });
