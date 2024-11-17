import * as points from "./points";
import * as zoom from "./zoom";

function buildAnnotation(dataPoint) {
  const annotation = document.createElement("div");

  annotation.id = "annotation";
  annotation.classList.add(
    "animate__animated",
    "animate__fadeIn",
    "animate__faster",
  );
  annotation.innerHTML = points.buildDataPointDetails(dataPoint);

  document.getElementById("chart").appendChild(annotation);
}

function enableAnnotation(dataPoint, xScale, yScale) {
  const annotation = document.getElementById("annotation");

  const x = xScale(dataPoint.x);
  const y = yScale(dataPoint.y);

  annotation.style.visibility = "visible";
  annotation.style.top = y + "px";
  annotation.style.left = x + "px";
}

function disableAnnotation() {
  const annotation = document.getElementById("annotation");

  if (!annotation) {
    return;
  }

  annotation.remove();

  // annotation.parentElement.removeChild(annotation);
}

export function updateAnnotation(dataPoint) {
  if (dataPoint == null) {
    disableAnnotation();
  } else {
    buildAnnotation(dataPoint);
    enableAnnotation(dataPoint, zoom.xScale, zoom.yScale);
  }
}
