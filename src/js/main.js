import * as d3 from "d3";

let data = [];
let concepts = {};
let quadtree = null;
const xScaleOriginal = d3.scaleLinear();
const yScaleOriginal = d3.scaleLinear();
let xScale = xScaleOriginal.copy();
let yScale = yScaleOriginal.copy();
let zoomTransform = d3.zoomIdentity;

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

  const width = document.getElementById("chart-d3").clientWidth;
  const height = document.getElementById("chart-d3").clientHeight;
  updateGlobalScaleDomains(width, height);
  transformLocalScaleDomains(d3.zoomIdentity);
  updateScaleRanges(width, height);
}

// Function to generate random data points
function generateRandomData(numPoints) {
  return Array.from({ length: numPoints }, () => ({
    x: Math.random() * 1000 - 500,
    y: Math.random() * 1000 - 500,
  }));
}

function updateGlobalScaleDomains(chartWidth, chartHeight) {
  // rescale the global domain to keep chart aspect ratio
  xScaleOriginal.domain([-chartWidth / 2, chartWidth / 2]);
  yScaleOriginal.domain([-chartHeight / 2, chartHeight / 2]);
}

function transformLocalScaleDomains(transform) {
  // rescale to present the area which should be visible after zoom
  const xRange = transform.rescaleX(xScaleOriginal).domain();
  const yRange = transform.rescaleY(yScaleOriginal).domain();

  xScale.domain(xRange);
  yScale.domain(yRange);
}

function updateScaleRanges(chartWidth, chartHeight) {
  const xRange = [0, chartWidth];
  const yRange = [chartHeight, 0];
  xScaleOriginal.range(xRange);
  yScaleOriginal.range(yRange);
  xScale.range(xRange);
  yScale.range(yRange);
}

function isDataPointInDomain(dataPoint, xScale, yScale) {
  const x = dataPoint.x;
  const y = dataPoint.y;

  const xDomain = xScale.domain();
  const yDomain = yScale.domain();

  if (x < xDomain[0] || x > xDomain[1] || y < yDomain[0] || y > yDomain[1]) {
    return false;
  }

  return true;
}

function getDataPointsToRender(dataPointsSorted, xScale, yScale) {
  const dataInDomain = dataPointsSorted.filter((d) =>
    isDataPointInDomain(d, xScale, yScale)
  );
  const dataToRender = dataInDomain.slice(0, 300);
  return dataToRender;
}

// ---------------------------------
enableLoadingScreen();
loadConcepts();
loadDataPoints();
initChart();
// ---------------------------------

// Create the SVG element with initial size
const svg = d3
  .select("#chart-d3")
  .append("svg")
  .attr("width", document.getElementById("chart-d3").clientWidth)
  .attr("height", document.getElementById("chart-d3").clientHeight)
  .call(
    d3
      .zoom()
      //   .scaleExtent([0.5, 20]) // Zoom scale limits
      .on("zoom", zoomed)
  )
  //   .call(responsivefy)
  .append("g");

// Create a group for all plot elements
const plotGroup = svg.append("g");

// Initial render of the scatterplot
function renderScatterPlot(data) {
  const shapes = plotGroup
    .selectAll(".city-shape")
    .data(data, (d) => d.clusterId);

  // ENTER phase for new data points
  const newShapes = shapes.enter().append("g").attr("class", "city-shape");

  // Append shapes depending on the city type
  newShapes.each(function (d) {
    const group = d3.select(this);

    if (d.numRecentArticles <= 50) {
      group
        .append("circle")
        .attr("cx", xScale(d.x))
        .attr("cy", yScale(d.y))
        .attr("r", 3)
        .style("fill", "white")
        .style("stroke", "black")
        .style("stroke-width", 1);
    } else if (d.numRecentArticles <= 200) {
      group
        .append("circle")
        .attr("cx", xScale(d.x))
        .attr("cy", yScale(d.y))
        .attr("r", 4)
        .style("fill", "white")
        .style("stroke", "black")
        .style("stroke-width", 1);
    } else if (d.numRecentArticles <= 500) {
      group
        .append("circle")
        .attr("cx", xScale(d.x))
        .attr("cy", yScale(d.y))
        .attr("r", 5)
        .style("fill", "white")
        .style("stroke", "black")
        .style("stroke-width", 1);

      group
        .append("circle")
        .attr("cx", xScale(d.x))
        .attr("cy", yScale(d.y))
        .attr("r", 2)
        .style("fill", "black")
        .style("stroke", "black")
        .style("stroke-width", 1);
    } else if (d.numRecentArticles <= 1000) {
      group
        .append("circle")
        .attr("cx", xScale(d.x))
        .attr("cy", yScale(d.y))
        .attr("r", 6)
        .style("fill", "white")
        .style("stroke", "black")
        .style("stroke-width", 1);

      group
        .append("circle")
        .attr("cx", xScale(d.x))
        .attr("cy", yScale(d.y))
        .attr("r", 3)
        .style("fill", "white")
        .style("stroke", "black")
        .style("stroke-width", 1);
    } else if (d.numRecentArticles > 1000) {
      group
        .append("circle")
        .attr("cx", xScale(d.x))
        .attr("cy", yScale(d.y))
        .attr("r", 7)
        .style("fill", "white")
        .style("stroke", "black")
        .style("stroke-width", 1);

      group
        .append("circle")
        .attr("cx", xScale(d.x))
        .attr("cy", yScale(d.y))
        .attr("r", 4)
        .style("fill", "black")
        .style("stroke", "black")
        .style("stroke-width", 1);
    }
  });

  // UPDATE phase for existing data points
  shapes.each(function (d) {
    const group = d3.select(this);

    if (d.numRecentArticles <= 50) {
      group.select("circle").attr("cx", xScale(d.x)).attr("cy", yScale(d.y));
    } else if (d.numRecentArticles <= 200) {
      group.select("circle").attr("cx", xScale(d.x)).attr("cy", yScale(d.y));
    } else if (d.numRecentArticles <= 500) {
      // two circles
      group.select("circle").attr("cx", xScale(d.x)).attr("cy", yScale(d.y));
      //   group.select("circle").attr("cx", xScale(d.x)).attr("cy", yScale(d.y));
    } else if (d.numRecentArticles <= 1000) {
      group.select("circle").attr("cx", xScale(d.x)).attr("cy", yScale(d.y));
    } else if (d.numRecentArticles > 1000) {
      group.select("circle").attr("cx", xScale(d.x)).attr("cy", yScale(d.y));
    }

    // if (d.numRecentArticles < 100) {
    //   group.select("circle").attr("cx", xScale(d.x)).attr("cy", yScale(d.y));
    // } else if (d.numRecentArticles < 1000) {
    //   group
    //     .select("rect")
    //     .attr("x", xScale(d.x) - 5)
    //     .attr("y", yScale(d.y) - 5);
    // } else {
    //   group
    //     .select("path")
    //     .attr("transform", `translate(${xScale(d.x)}, ${yScale(d.y)})`);
    // }
  });

  // EXIT phase for removed data points
  shapes.exit().remove();
}

// Initial rendering of the scatterplot
renderScatterPlot(data);

// Define the zoom function
function zoomed(event) {
  zoomTransform = event.transform;

  const width = document.getElementById("chart-d3").clientWidth;
  const height = document.getElementById("chart-d3").clientHeight;
  updateGlobalScaleDomains(width, height);
  transformLocalScaleDomains(zoomTransform);
  updateScaleRanges(width, height);

  // Update points
  plotGroup
    .selectAll("circle")
    .attr("cx", (d) => xScale(d.x))
    .attr("cy", (d) => yScale(d.y));

  const _data = getDataPointsToRender(data, xScale, yScale);
  renderScatterPlot(_data);
}

window.addEventListener("resize", () => {
  const width = document.getElementById("chart-d3").clientWidth;
  const height = document.getElementById("chart-d3").clientHeight;
  updateGlobalScaleDomains(width, height);
  transformLocalScaleDomains(zoomTransform);
  updateScaleRanges(width, height);
  d3.select("svg").attr("width", width).attr("height", height);

  const _data = getDataPointsToRender(data, xScale, yScale);
  renderScatterPlot(_data);
});
