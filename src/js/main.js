// import { seriesSvgAnnotation } from "./annotation-series.js";
import * as d3 from "d3";
import * as fc from "d3fc";
import { INFINITY } from "chart.js/helpers";
import Clusters from "../clusters.svg";

let data = [];
let concepts = {};
let quadtree;

// create a web worker that streams the chart data
const streamingLoaderWorker = new Worker(
  new URL("./streaming-tsv-parser.js", import.meta.url).href
);

const streamingLoaderWorker0 = new Worker(
  new URL("./streaming-tsv-parser.js", import.meta.url).href
);

function getClusterCategoryList() {
  return [
    "biology",
    "chemistry",
    "computer science",
    "earth science",
    "engineering",
    "humanities",
    "materials science",
    "mathematics",
    "medicine",
    "physics",
    "social science",
  ];
}

function clusterCategoryIdToText(clusterCategoryId) {
  return getClusterCategoryList()[clusterCategoryId];
}

function clusterCategoryPalette() {
  const alpha = 1.0;
  return [
    [0.875, 0.125, 0.125, alpha],
    [0.875, 0.5341, 0.125, alpha],
    [0.8068, 0.875, 0.125, alpha],
    [0.3977, 0.875, 0.125, alpha],
    [0.125, 0.875, 0.2614, alpha],
    [0.125, 0.875, 0.6705, alpha],
    [0.125, 0.6705, 0.875, alpha],
    [0.125, 0.2614, 0.875, alpha],
    [0.3977, 0.125, 0.875, alpha],
    [0.8068, 0.125, 0.875, alpha],
    [0.875, 0.125, 0.5341, alpha],
  ];
}

function clusterCategoryIdToColor(clusterCategoryId) {
  return clusterCategoryPalette()[clusterCategoryId];
}

function keyConceptsIdsParse(keyConceptsRaw) {
  return keyConceptsRaw.split(",");
}

streamingLoaderWorker.onmessage = ({
  data: { items, totalBytes, finished },
}) => {
  const rows = items.map((d) => ({
    clusterId: Number(d["cluster_id"]),
    x: Number(d["x"]),
    y: Number(d["y"]),
    numRecentArticles: Number(d["num_recent_articles"]),
    growthRating: Number(d["growth_rating"]),
    clusterCategoryId: Number(d["cluster_category"]),
    keyConcepts: keyConceptsIdsParse(d["key_concepts"]),
  }));
  data = data.concat(rows);

  if (finished) {
    // create a spatial index for rapidly finding the closest datapoint
    quadtree = d3
      .quadtree()
      .x((d) => d.x)
      .y((d) => d.y)
      .addAll(data);

    handleInit();
  }
  // redraw();
};

streamingLoaderWorker.postMessage(
  new URL("./processed1_data.tsv", import.meta.url).href
);

streamingLoaderWorker0.onmessage = ({
  data: { items, totalBytes, finished },
}) => {
  items.map((d) => {
    concepts[d["index"]] = d["key"];
  });
};

streamingLoaderWorker0.postMessage(
  new URL("./processed0_keys.tsv", import.meta.url).href
);

function initForeground() {
  const outer = document.getElementById("chart-svg");
  const svg = outer.getElementsByTagName("svg")[0];
  svg.id = "chart-svg-content";
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("viewBox", "0 0 100 100");
  updateForeground();
}

function handleInit() {
  const loadingElement = document.getElementById("loading");
  const chartElement = document.getElementById("chart");

  loadingElement.style.display = "none";
  chartElement.style.display = "block";

  updateGlobalScaleDomains(chartElement.clientWidth, chartElement.clientHeight);
  transformLocalScaleDomains(d3.zoomIdentity);
  redraw();

  initForeground();

  // const svg = d3
  //   .select("#chart")
  //   .append("svg")
  //   .attr("width", "100%")
  //   .attr("height", "100%")
  //   // .call(
  //   //   d3.zoom().on("zoom", (event) => {
  //   //     svg.attr("transform", event.transform);
  //   //   })
  //   // )
  //   .append("g");

  // svg
  //   .append("path")
  //   .attr("d", "M10 80 Q 95 10 180 80 T 280 80") // example path
  //   .attr("stroke", "black")
  //   .attr("fill", "transparent");
}

const xScaleOriginal = d3.scaleLinear();
const yScaleOriginal = d3.scaleLinear();
const xScale0 = xScaleOriginal.copy();
const yScale0 = yScaleOriginal.copy();
const xScale = xScaleOriginal.copy();
const yScale = yScaleOriginal.copy();
let xPointer = NaN;
let yPointer = NaN;
let closestPoint = null;
let isAnnotationEnabled =
  document.getElementById("annotation").style.visibility == "visible";
let isArticleEnabled =
  document.getElementById("article").style.visibility == "visible";

function updateGlobalScaleDomains(chartWidth, chartHeight) {
  // rescale the global domain to keep chart aspect ratio
  xScaleOriginal.domain([-chartWidth / 2, chartWidth / 2]);
  yScaleOriginal.domain([-chartHeight / 2, chartHeight / 2]);
}

function transformLocalScaleDomains(transform) {
  // resacle to present the area which should be visible after zoom
  const xRange = transform.rescaleX(xScaleOriginal).domain();
  const yRange = transform.rescaleY(yScaleOriginal).domain();

  xScale.domain(xRange);
  yScale.domain(yRange);

  xScale0.domain(xRange);
  yScale0.domain(yRange);
}

let zoomTransform = d3.zoomIdentity;

function updateForeground() {
  const svg = document.getElementById("chart-svg-content");

  const width = xScale0.domain()[1] - xScale0.domain()[0];
  const height = yScale0.domain()[1] - yScale0.domain()[0];
  const x = xScale0.domain()[0];
  const y = yScale0.domain()[0];

  // we need to convert to the SVG coordinate system
  const y_prim = -y - height;

  svg.viewBox.baseVal.x = x;
  svg.viewBox.baseVal.y = y_prim;
  svg.viewBox.baseVal.width = width;
  svg.viewBox.baseVal.height = height;
}

function handleZoomEvent(zoomEvent) {
  zoomTransform = zoomEvent.transform;

  const chartElement = document.getElementById("chart");
  updateGlobalScaleDomains(chartElement.clientWidth, chartElement.clientHeight);
  transformLocalScaleDomains(zoomTransform);

  updateAnnotation(closestPoint, xScale0, yScale0);
  updateForeground();

  redraw();
}

function buildZoom() {
  return d3
    .zoom()
    .scaleExtent([0.8, 1000])
    .translateExtent([
      [-INFINITY, -INFINITY],
      [INFINITY, INFINITY],
    ])
    .on("zoom", handleZoomEvent);
}

const zoom = buildZoom();

const annotations = [];

function buildFcPointer() {
  return fc.pointer().on("point", ([coord]) => {
    if (!coord || !quadtree) {
      return;
    }

    const x = xScale0.invert(coord.x);
    const y = yScale0.invert(coord.y);
    // console.log(coord, xScale0.domain(), yScale0.domain(), x, y);

    const radius = 5.0;
    // find the closes datapoint to the pointer
    const closestDatum = quadtree.find(x, y, radius);

    xPointer = x;
    yPointer = y;

    if (closestDatum) {
      closestPoint = closestDatum;
    } else {
      closestPoint = null;
    }

    onPoint(coord.x, coord.y, x, y, closestPoint, xScale0, yScale0);

    // redraw();
  });
}
const pointer = buildFcPointer();

function pointDecorateProgram(data, program) {
  fc
    .webglFillColor()
    .value((dataPoint) => clusterCategoryIdToColor(dataPoint.clusterCategoryId))
    .data(data)(program);

  fc
    .webglStrokeColor()
    .value((_) => [0.0, 0.0, 0.0, 0.5])
    .data(data)(program);
}

function pointDecorateShaderProgram(data, program) {
  program
    .fragmentShader()
    .appendHeader(
      "precision mediump float; uniform vec4 fill; uniform vec4 stroke;"
    ).appendBody(`
      vec2 d = gl_PointCoord.xy - 0.5;
      vec4 col = vec4(0.0, 0.0, 0.0, 0.6 - 0.6 * smoothstep(0.4, 0.5, length(d)));
      gl_FragColor = col;
  `);
}

function shaderProgramSetBlend(program) {
  const gl = program.context();
  gl.enable(gl.BLEND);
  gl.blendFuncSeparate(
    gl.SRC_ALPHA,
    gl.ONE_MINUS_SRC_ALPHA,
    gl.ONE,
    gl.ONE_MINUS_SRC_ALPHA
  );
}

function pointDataToSize(pointData, k = 1.0) {
  k = Math.max(0.5, Math.min(k, 3.0));
  return Math.max(
    100,
    Math.min(1000 * k * (pointData.numRecentArticles / 1000), 10000)
  );
}
function buildFcPointSeries(k = 1.0) {
  return fc
    .seriesWebglPoint()
    .equals((a, b) => a === b)
    .size((pointData) => pointDataToSize(pointData, k))
    .crossValue((pointData) => pointData.x)
    .mainValue((pointData) => pointData.y)
    .decorate((program) => {
      pointDecorateProgram(data, program);
      // pointDecorateShaderProgram(data, program);
      shaderProgramSetBlend(program);
    });
}

const debugInfo = {};

function printDebug(key, value) {
  const debugDiv = document.getElementById("debug-body");
  debugInfo[key] = value;

  let html = "";
  for (const k of Object.keys(debugInfo)) {
    html += k + ": " + debugInfo[k] + "<br />";
  }
  debugDiv.innerHTML = html;
}

let pointSeries = buildFcPointSeries();

function onClick(x, y) {
  if (closestPoint == null) {
    disableArticle();
  } else {
    enableArticle(closestPoint);
    // window.open(
    //   "https://sciencemap.eto.tech/cluster/?version=2&cluster_id=" +
    //     closestPoint.clusterId,
    //   "_blank"
    // );
  }
  updateAnnotation(closestPoint, xScale0, yScale0);

  if (closestPoint != null) {
    const xx = closestPoint.x;
    const yy = closestPoint.y;

    // d3.select("d3fc-svg.plot-area")
    //   .transition()
    //   .duration(1000)
    //   .call(zoom.transform, d3.zoomIdentity.translate(xx, yy));
  }
}

function updateAnnotation(dataPoint, xScale, yScale) {
  if (dataPoint == null) {
    disableAnnotation();
  } else {
    buildAnnotation(dataPoint);
    enableAnnotation(dataPoint, xScale, yScale);
  }
}

function buildAnnotation(dataPoint) {
  const annotation = document.getElementById("annotation-body");

  let html = "";

  // cluster id
  html += "<strong>#" + dataPoint.clusterId + "</strong>" + "<br />";

  // cluster category
  html += clusterCategoryIdToText(dataPoint.clusterCategoryId) + "<br />";

  // number of articles
  if (dataPoint.numRecentArticles <= 100) {
    html += "<span class='few-articles'>";
  } else if (dataPoint.numRecentArticles >= 1000) {
    html += "<span class='many-articles'>";
  } else {
    html += "<span>";
  }
  html += "articles: " + dataPoint.numRecentArticles + "</span><br />";

  // growth rating
  if (dataPoint.growthRating >= 80) {
    html += "<span class='many-articles'>";
  } else {
    html += "<span>";
  }
  html += "growth: " + dataPoint.growthRating + "</span><br />";

  // key concepts

  html += "<br /><strong>key concepts:</strong><ul>";

  for (const concept_id of dataPoint.keyConcepts) {
    html += "<li>" + concepts[Number(concept_id)] + "</li>";
  }

  html += "</ul>";

  annotation.innerHTML = html;
}

function enableAnnotation(dataPoint, xScale, yScale) {
  const annotation = document.getElementById("annotation");
  isAnnotationEnabled = true;

  const x = xScale(dataPoint.x);
  const y = yScale(dataPoint.y);

  annotation.style.visibility = "visible";
  annotation.style.top = y + "px";
  annotation.style.left = x + "px";
}

function disableAnnotation() {
  const annotation = document.getElementById("annotation");
  annotation.style.visibility = "hidden";
  isAnnotationEnabled = false;
}

function buildArticle(dataPoint) {
  const article = document.getElementById("article-content");
  const url =
    "https://sciencemap.eto.tech/cluster/?version=2&cluster_id=" +
    dataPoint.clusterId;

  article.innerHTML =
    "<iframe src='" + url + "' width='100%' height='100%'></iframe>";

  const articleClose = document.getElementById("article-close");
  articleClose.onclick = () => {
    disableArticle();
  };

  const articleOpen = document.getElementById("article-open");
  articleOpen.onclick = () => {
    window.open(url, "_blank");
  };
}

function disableArticle() {
  const article = document.getElementById("article");
  article.style.visibility = "hidden";
  isArticleEnabled = false;
}

function enableArticle(dataPoint) {
  const article = document.getElementById("article");
  buildArticle(dataPoint);
  article.style.visibility = "visible";
  isArticleEnabled = true;
}

function onPoint(
  xSite,
  ySite,
  xChart,
  yChart,
  nearestDataPoint,
  xScale,
  yScale
) {
  printDebug("pointer (site?)", xSite + " " + ySite);
  printDebug("pointer (chart)", xChart + " " + yChart);
  printDebug("isAnnotation", isAnnotationEnabled);
  printDebug("isArticle", isArticleEnabled);

  printDebug(
    "point (chart)",
    nearestDataPoint != null
      ? nearestDataPoint.x + " " + nearestDataPoint.y
      : null
  );
  printDebug(
    "point (site?)",
    nearestDataPoint != null
      ? xScale(nearestDataPoint.x) + " " + yScale(nearestDataPoint.y)
      : null
  );

  updateAnnotation(nearestDataPoint, xScale, yScale);
}

function updateScaleRanges(chartWidth, chartHeight) {
  const xRange = [0, chartWidth];
  const yRange = [chartHeight, 0];

  xScaleOriginal.range(xRange);
  yScaleOriginal.range(yRange);
  xScale0.range(xRange);
  yScale0.range(yRange);
  xScale.range(xRange);
  yScale.range(yRange);
}

function handleResizeEvent(eventResize) {
  const width = eventResize.width;
  const height = eventResize.height;

  updateGlobalScaleDomains(width, height);
  transformLocalScaleDomains(zoomTransform);
  updateScaleRanges(width, height);

  redraw();
}

function handleMeasureEvent(eventMeasure) {
  if (eventMeasure.detail.resized) {
    handleResizeEvent(eventMeasure.detail);
  }
}

function buildChart(
  xScale,
  yScale,
  xScaleOriginal,
  yScaleOriginal,
  pointSeries,
  zoom,
  pointer
) {
  return (
    fc
      .chartCartesian(xScale, yScale)
      .webglPlotArea(
        // only render the point series on the WebGL layer
        fc
          .seriesWebglMulti()
          .series([pointSeries])
          .mapping((d) => d.data)
      )
      // .svgPlotArea(
      //   // only render the annotations series on the SVG layer
      // fc.seriesSvgMulti()
      //   // .series([annotationSeries])
      //   // .mapping((d) => d.annotations)
      // )
      .decorate((sel) => {
        sel
          .enter()
          // .select("d3fc-svg.plot-area")
          .on("measure", handleMeasureEvent)
          .call(pointer)
          .call(zoom)
          .on("click", (event) => {
            onClick(xPointer, yPointer);
          })
          /**
           * Below line fixes error with:
           * (0 , d3_selection__WEBPACK_IMPORTED_MODULE_7__.default)(...).transition is not a function
           * TypeError: (0 , d3_selection__WEBPACK_IMPORTED_MODULE_7__.default)(...).transition is not a function
           */
          .on("dblclick.zoom", null);

        // d3.select("#chart").select("#chart-svg-content").call(zoom);
      })
  );
}

function axisHide() {
  /**
   * Hides d3fc axis. Probably the easiest way to acheve that.
   * An alternative is to use pure CSS and add !important tag.
   *
   * Warning: this method breaks pointing / displaying annotations.
   */
  d3.select("#chart")
    .select("d3fc-svg.x-axis") // .style("visibility", "hidden");
    .style("height", "0")
    .style("width", "0");
  d3.select("#chart")
    .select("d3fc-svg.y-axis") // .style("visibility", "hidden");
    .style("height", "0")
    .style("width", "0");
}

let chart = buildChart(
  xScale,
  yScale,
  xScaleOriginal,
  yScaleOriginal,
  pointSeries,
  zoom,
  pointer
);

// render the chart with the required data
// Enqueues a redraw to occur on the next animation frame
function redraw() {
  d3.select("#chart").datum({ annotations, data }).call(chart);
  // d3.select("#chart").on("click", (event) => {
  //   console.log("clicked");
  // });
  // d3.select("#chart").on("dbclick", (event) => {
  //   console.log("bdclicked");
  // });
}
