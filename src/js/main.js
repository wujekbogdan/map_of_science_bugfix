// import { seriesSvgAnnotation } from "./annotation-series.js";
import * as d3 from "d3";
import * as fc from "d3fc";
import { INFINITY } from "chart.js/helpers";

let data = [];
let quadtree;

// create a web worker that streams the chart data
const streamingLoaderWorker = new Worker(
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
  const alpha = 0.75;
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
    document.getElementById("loading").style.display = "none";

    // create a spatial index for rapidly finding the closest datapoint
    quadtree = d3
      .quadtree()
      .x((d) => d.x)
      .y((d) => d.y)
      .addAll(data);
  }
  redraw();
};

streamingLoaderWorker.postMessage(
  new URL("./processed1_data.tsv", import.meta.url).href
);

const xScale = d3.scaleLinear().domain([-500, 500]);
const yScale = d3.scaleLinear().domain([-500, 500]);
const xScaleOriginal = xScale.copy();
const yScaleOriginal = yScale.copy();
let xPointer = NaN;
let yPointer = NaN;
let closestPoint = null;

function buildAnnotationData(pointData) {
  return {
    note: {
      label: clusterCategoryIdToText(pointData.clusterCategoryId),
      bgPadding: 10,
      title: "#" + pointData.clusterId,
    },
    x: pointData.x,
    y: pointData.y,
    dx: 20,
    dy: 20,
  };
}

function buildZoom() {
  return d3
    .zoom()
    .scaleExtent([0.8, 1000])
    .translateExtent([
      [-INFINITY, -INFINITY],
      [INFINITY, INFINITY],
    ])
    .on("zoom", (event) => {
      // update the scales based on current zoom
      xScale.domain(event.transform.rescaleX(xScaleOriginal).domain());
      yScale.domain(event.transform.rescaleY(yScaleOriginal).domain());

      // const k = event.transform.k;

      // const pointSeries0 = buildFcPointSeries(k);

      // chart = buildChart(
      //   xScale,
      //   yScale,
      //   xScaleOriginal,
      //   yScaleOriginal,
      //   pointSeries0,
      //   zoom,
      //   pointer
      // );

      redraw();
    });
}

const zoom = buildZoom();

const annotations = [];

function buildFcPointer() {
  return fc.pointer().on("point", ([coord]) => {
    annotations.pop();

    if (!coord || !quadtree) {
      return;
    }

    const x = xScale.invert(coord.x);
    const y = yScale.invert(coord.y);

    const radius = 5.0;
    // find the closes datapoint to the pointer
    const closestDatum = quadtree.find(x, y, radius);

    xPointer = x;
    yPointer = y;

    if (closestDatum) {
      annotations[0] = buildAnnotationData(closestDatum);
      closestPoint = closestDatum;
    } else {
      closestPoint = null;
    }

    onPoint(coord.x, coord.y, x, y, closestPoint, xScale, yScale);

    redraw();
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

let pointSeries = buildFcPointSeries();

function onClick(x, y) {
  if (closestPoint == null) {
    disableArticle();
  } else {
    enableArticle(closestPoint);
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

  annotation.innerHTML = html;
}

function enableAnnotation(nearestDataPoint, xScale, yScale) {
  const annotation = document.getElementById("annotation");

  /* TODO: investigate why its needed */
  const offset = 16;

  const x = xScale(nearestDataPoint.x) + offset;
  const y = yScale(nearestDataPoint.y) + offset;

  annotation.style.visibility = "visible";
  annotation.style.top = y + "px";
  annotation.style.left = x + "px";
}

function disableAnnotation() {
  const annotation = document.getElementById("annotation");
  annotation.style.visibility = "hidden";
}

function buildArticle(dataPoint) {}

function disableArticle() {
  const article = document.getElementById("article");
  article.style.visibility = "hidden";
}

function enableArticle(dataPoint) {
  const article = document.getElementById("article");
  buildArticle(dataPoint);
  article.style.visibility = "visible";
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
  updateAnnotation(nearestDataPoint, xScale, yScale);
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
  return fc
    .chartCartesian(xScale, yScale)
    .webglPlotArea(
      // only render the point series on the WebGL layer
      fc
        .seriesWebglMulti()
        .series([pointSeries])
        .mapping((d) => d.data)
    )
    .svgPlotArea(
      // only render the annotations series on the SVG layer
      fc.seriesSvgMulti()
      // .series([annotationSeries])
      // .mapping((d) => d.annotations)
    )
    .decorate((sel) =>
      sel
        .enter()
        .select("d3fc-svg.plot-area")
        .on("measure.range", (event) => {
          xScaleOriginal.range([0, event.detail.width]);
          yScaleOriginal.range([event.detail.height, 0]);
          axisHide();
        })
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
        .on("dblclick.zoom", null)
    );
}

function axisHide() {
  /**
   * Hides d3fc axis. Probably the easiest way to acheve that.
   * An alternative is to use pure CSS and add !important tag.
   *
   * Warning: this method breaks pointing / displaying annotations.
   */

  d3.select("#chart").select("d3fc-svg.x-axis").style("visibility", "hidden");
  // .style("height", "0")
  // .style("width", "0");
  d3.select("#chart").select("d3fc-svg.y-axis").style("visibility", "hidden");
  // .style("height", "0")
  // .style("width", "0");
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
  updateAnnotation(closestPoint, xScale, yScale);
  // d3.select("#chart").on("click", (event) => {
  //   console.log("clicked");
  // });
  // d3.select("#chart").on("dbclick", (event) => {
  //   console.log("bdclicked");
  // });
}
