import _ from "lodash";
import "../scss/styles.scss";
import "bootstrap";
import * as d3 from "d3";
import Chart from "chart.js/auto";

document.addEventListener("DOMContentLoaded", function () {
  render();
});

function render() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const container = document.getElementById("container");

  // Create the SVG container.
  const svg = d3.create("svg").attr("width", width).attr("height", height);

  // Create random Gaussian variables for X and Y coordinates
  const randomX = d3.randomNormal(1000 / 2, 80);
  const randomY = d3.randomNormal(1000 / 2, 80);
  const data = Array.from({ length: 1000 }, () => [randomX(), randomY()]);

  // Add scatter plot points
  const circle = svg
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("transform", (d) => `translate(${d})`)
    .attr("r", 1.5);

  svg.call(
    d3
      .zoom()
      .extent([
        [0, 0],
        [width, height],
      ])
      .scaleExtent([1, 8])
      .on("zoom", zoomed)
  );

  function zoomed({ transform }) {
    circle.attr("transform", (d) => `translate(${transform.apply(d)})`);
  }

  // Append the SVG element.
  container.append(svg.node());
}
