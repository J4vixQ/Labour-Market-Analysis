function drawMap(data) {
    console.log("drawMap");

    // Set up dimensions
    const width = 1200;
    const height = 600;

    // Define the projection with a center and scale for Europe
    const projection = d3.geoMercator()
        .center([80, 34.5]) // Center on Europe
        .scale(520) // Zoom scale to fit Europe
        .translate([width / 2, height / 2]); // Center map in SVG

    const path = d3.geoPath().projection(projection);

    // Create svg
    const svg = d3.select("#map-container").append("svg")
        .attr("width", width)
        .attr("height", height);

    // Add a group element to hold the map
    const mapGroup = svg.append("g");

    // Define zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 8]) // Limit zoom level (1x to 8x)
        .filter((event) => event.type !== 'dblclick') // Prevent default double-click zoom, dblclick would be used for reset map
        .on("zoom", (event) => {
            mapGroup.attr("transform", event.transform); // Apply zoom and drag transformation
        });

    // Attach zoom behavior to the SVG element
    svg.call(zoom);

    // Set default zoom transform
    const defaultTransform = d3.zoomIdentity
        .translate(width / 2, height / 2)
        .scale(1);
    svg.call(zoom.transform, defaultTransform);

    // Add a double-click event to reset zoom
    svg.on("dblclick", function () {
        svg.transition().duration(750).call(zoom.transform, defaultTransform);
    });

    // Add dropdown menus above the map
    const dropdownContainer = d3.select("#map-container")
        .insert("div", "svg") // Insert before the SVG
        .attr("id", "dropdown-container")
        .style("margin-bottom", "10px");

    // Dropdown options
    const metrics = [
        { value: "workpopK", label: "Working age population" },
        { value: "labourR", label: "Labour force participation rate" },
        { value: "employR", label: "Employment to population ratio" },
        { value: "unemployR", label: "Unmployment rate" },
        // { value: "earning", label: "Average monthly earning" }
    ];

    const categories = [
        { value: "total", label: "total" },
        { value: "sex", label: "By gender" },
        { value: "birthplace", label: "By birthplace" },
        { value: "sexC", label: "Male/Female ratio" },
        { value: "birthplaceC", label: "Native/Foreign ratio" },
    ];

    // Create the first dropdown for metrics
    dropdownContainer.append("label")
        .attr("for", "metric-dropdown")
        .text("Metric: ");

    const metricDropdown = dropdownContainer.append("select")
        .attr("id", "metric-dropdown")
        .style("margin-right", "20px");

    metricDropdown.selectAll("option")
        .data(metrics)
        .enter()
        .append("option")
        .attr("value", d => d.value)
        .text(d => d.label);

    // Create the second dropdown for categories
    dropdownContainer.append("label")
        .attr("for", "category-dropdown")
        .text("Category: ");

    const categoryDropdown = dropdownContainer.append("select")
        .attr("id", "category-dropdown");

    categoryDropdown.selectAll("option")
        .data(categories)
        .enter()
        .append("option")
        .attr("value", d => d.value)
        .text(d => d.label);

    // Scrubber
    const years = Array.from(new Set(data.map(d => d.year))).sort(); // Extract unique years
    let selectedYear = years.includes(2023) ? 2023 : years[0];

    // Add a scrubber for selecting the year
    const scrubberContainer = d3.select("#map-container")
        .insert("div", "svg")
        .attr("id", "scrubber-container")
        .style("margin-bottom", "10px");

    const scrubber = Scrubber(years, {
        format: d => `Year: ${d}`,
        initial: years.indexOf(selectedYear), // Start scrubber at the index of the selectedYear
        autoplay: false,
        loop: false,
        delay: 1000,
    });
    
    scrubberContainer.node().appendChild(scrubber);

    // Load GeoJSON data and call appropriate sub-function
    d3.json("public/europe.geo.json")
        .then(function (geoData) {
            if (!geoData.features) {
                console.error("Invalid GeoJSON structure");
                return;
            }

            // Function to redraw the map
            function updateMap() {
                // Hide tooltip on update
                d3.select(".maptooltip").style("display", "none");
            
                // Metric decides map value
                const selectedMetric = metricDropdown.property("value");
                // Category decides map type
                const selectedCategory = categoryDropdown.property("value");
            
                // Call sub drawMap functions
                if (selectedCategory === "total") {
                    drawMap1(data, geoData, selectedMetric, selectedCategory, selectedYear, mapGroup, path, svg, zoom, defaultTransform);
                } else if (selectedCategory === "sex" || selectedCategory === "birthplace") {
                    drawMap2(data, geoData, selectedMetric, selectedCategory, selectedYear, mapGroup, path, svg, zoom, defaultTransform);
                } else if (selectedCategory === "sexC" || selectedCategory === "birthplaceC") {
                    drawMapC(data, geoData, selectedMetric, selectedCategory, selectedYear, mapGroup, path, svg, zoom, defaultTransform);
                }
            }
            
            // Initial draw
            updateMap();

            // Event listeners for dropdown changes
            metricDropdown.on("change", updateMap);
            categoryDropdown.on("change", updateMap);

            // Scrubber listener
            scrubber.addEventListener("input", event => {
                selectedYear = years[event.target.valueAsNumber]; // Map index to actual year
                updateMap();
            });
        })
        .catch(function (error) {
            console.error("Error loading the GeoJSON file:", error);
        });
}





function drawMap1(data, geoData, metric, category, selectedYear, mapGroup, path, svg, zoom, defaultTransform) {
    // drawMap1 is a Choropleth
    console.log("Drawing map", metric, "in total");

    // Remove existing legend (if any)
    svg.selectAll("#legend-group").remove();
    svg.selectAll("#bivariate-legend").remove();
    svg.selectAll("#legend-compare").remove();

    // Calculate global min and max for the metric, In this case, sex, education and birthplace are set to Total
    const metricValuesGlobal = data
        .filter(record => record[metric] != null && 
            record.sex === "Total" &&
            record.education === "Total" &&
            record.birthplace === "Total"
        )
        .map(record => record[metric]);

    const globalMin = Math.min(...metricValuesGlobal);
    const globalMax = Math.max(...metricValuesGlobal);

    // Filter the data based on the category, metric, and selected year
    const filteredData = data.filter(record => {
        if (record.year !== selectedYear) return false;

        if (category === "total") {
            return (
                record.sex === "Total" &&
                record.education === "Total" &&
                record.birthplace === "Total" &&
                record[metric] != null
            );
        }

        return record[metric] != null;
    });

    // Map filtered data to GeoJSON by country
    geoData.features.forEach(feature => {
        const countryData = filteredData.find(d => d.country === feature.properties.name);
        feature.properties.metricValue = countryData ? countryData[metric] : null;
    });

    // Color scale using global min and max
    let cs;
    if (metric === "unemployR") {
        cs = d3.interpolateReds;
    } else {
        cs = d3.interpolateBlues;
    }
    const colorScale = d3.scaleSequential()
        .domain([globalMin, globalMax])
        .interpolator(cs);
    
    // Define missing data texture
    const defs = svg.append("defs");

    const pattern = defs.append("pattern")
        .attr("id", "missing-data-pattern")
        .attr("width", 8)  // Adjust pattern spacing
        .attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse");

    // Add lines to the pattern
    pattern.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", 4).attr("y2", 4)
        .attr("stroke", "#555")
        .attr("stroke-width", 0.5);
    
    // Clear the existing map
    mapGroup.selectAll(".country").remove();

    // Create a tooltip element
    d3.selectAll(".maptooltip").remove();
    const tooltip = d3.select("body").append("div")
    .attr("class", "maptooltip");

    // Draw map with updated data
    mapGroup.selectAll(".country")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", d => {
            const value = d.properties.metricValue;
            return value != null ? colorScale(value) : "url(#missing-data-pattern)"; // Default pattern for missing data
        })
        .on("mouseover", function (event, d) {
            d3.select(this)
              .style("stroke-width", "2")
              .style("stroke", "#000");
          
            // Decide the unit
            const unit = metric === "workpopK" ? " thousand" : " %";
            const valueString = d.properties.metricValue != null 
              ? d.properties.metricValue.toFixed(2) + unit
              : "No data";
          
            // Show the tooltip
            tooltip.style("display", "block")
              .html(`
                <strong>Country:</strong> ${d.properties.name}<br>
                <strong>Value:</strong> ${valueString}
              `)
              .style("left", (event.pageX + 10) + "px")
              .style("top", (event.pageY + 10) + "px");
        })
        .on("mousemove", function (event) {
            // Update tooltip position
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function () {
            d3.select(this)
                .style("stroke-width", "0.5")  // reset border
                .style("stroke", "#000");

            // Hide the tooltip
            tooltip.style("display", "none");
        })
        .on("click", function (event, d) {
            const [[x0, y0], [x1, y1]] = path.bounds(d); // Get bounding box of the country
            const countryWidth = x1 - x0;
            const countryHeight = y1 - y0;

            const scale = Math.min(8, 0.9 / Math.max(countryWidth / 960, countryHeight / 600));
            const translate = [
                960 / 2 - scale * (x0 + x1) / 2,
                600 / 2 - scale * (y0 + y1) / 2,
            ];

            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
        });

    // Update the legend with global min and max
    mapLegend1(svg, colorScale, metric, [globalMin, globalMax]);
}

function mapLegend1(svg, colorScale, metric, globalRange) {
    const legendWidth = 300;
    const legendHeight = 20;
    const [globalMin, globalMax] = globalRange; // Using global range to maintain legend consistency

    // Clear any existing legend
    svg.selectAll("#legend-group").remove();
    svg.selectAll("#legend-gradient").remove();
    svg.selectAll("#legend-compare").remove();

    // Create a group for the legend
    const legendGroup = svg.append("g")
        .attr("id", "legend-group")
        .attr("transform", `translate(10, 10)`);

    // Define a gradient for the legend
    const gradient = svg.append("defs").append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%");

    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorScale(globalMin)); // Color for the minimum value

    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorScale(globalMax)); // Color for the maximum value

    // Add a rectangle filled with the gradient
    legendGroup.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    // Create a scale for the legend axis
    const legendScale = d3.scaleLinear()
        .domain([globalMin, globalMax])
        .range([0, legendWidth]);

    // Add the legend axis
    const legendAxis = d3.axisBottom(legendScale)
        .ticks(5)  // Number of ticks
        .tickSize(-legendHeight);

    legendGroup.append("g")
        .attr("transform", `translate(0, ${legendHeight})`)
        .call(legendAxis)
        .select(".domain").remove();  // Remove the axis line

    // Unit label based on the metric
    const metricLabels = {
        workpopK: "Working age population (thousands)",
        labourR: "Labour force participation rate (%)",
        employR: "Employment to population ratio (%)",
        unemployR: "Unemployment rate (%)",
        earning: "Average monthly earning ($)"
    };

    const label = metricLabels[metric] || "";

    legendGroup.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", legendHeight + 35)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(label);
}





function bivariateColorScale(c00, c01, c10, c11, n = 3) {
    // Helper function to interpolate between two colors
    function interpolateColor(color1, color2, t) {
        return color1.map((v, i) => Math.round(v + t * (color2[i] - v)));
    }

    const colors = [];
    for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
            const tX = x / (n - 1);  // Fraction along x-axis
            const tY = y / (n - 1);  // Fraction along y-axis

            // Interpolate along x for top and bottom rows
            const top = interpolateColor(c00, c01, tX);
            const bottom = interpolateColor(c10, c11, tX);

            // Interpolate along y-axis
            const color = interpolateColor(top, bottom, tY);

            // Convert to CSS rgb format and add to result
            colors.push(`rgb(${color[0]}, ${color[1]}, ${color[2]})`);
        }
    }
    return colors;
}

function drawMap2(data, geoData, metric, category, selectedYear, mapGroup, path, svg, zoom, defaultTransform) {
    // drawMap2 is a Bivariate Choropleth
    console.log("Drawing bivariate map");

    // Remove existing legend (if any)
    svg.selectAll("#legend-group").remove();
    svg.selectAll("#bivariate-legend").remove();
    svg.selectAll("#legend-compare").remove();

    // call sub functions
    if (category === "sex") {
        drawMap2BySex(data, geoData, metric, selectedYear, mapGroup, path, svg, zoom, defaultTransform);
    } else if (category === "birthplace") {
        drawMap2ByBirthplace(data, geoData, metric, selectedYear, mapGroup, path, svg, zoom, defaultTransform);
    }
}

function drawMap2BySex(data, geoData, metric, selectedYear, mapGroup, path, svg, zoom, defaultTransform) {
    console.log("Drawing bivariate map by sex with", metric);

    const c00 = [240, 240, 240]; // Top-left corner white
    const c01 = [222, 89, 146];   // Top-right corner red - female
    const c10 = [68, 189, 219]; // Bottom-left corner blue - male
    const c11 = [64, 45, 87];    // Bottom-right corner black

    const colormatrix = bivariateColorScale(c00, c01, c10, c11);
    // Color schemes
    const schemes = [
        {
            name: "RdBu",
            colors: colormatrix
        }
    ];

    // Calculate global min and max, but still in sex groups
    const allMaleValues = data.filter(d => 
        d.sex === "Male" && 
        d[metric] != null &&
        d.education === "Total" &&
        d.birthplace === "Total").map(d => d[metric]);
    const allFemaleValues = data.filter(d => 
        d.sex === "Female" && 
        d[metric] != null &&
        d.education === "Total" &&
        d.birthplace === "Total").map(d => d[metric]);
    const globalMinMale = Math.min(...allMaleValues);
    const globalMaxMale = Math.max(...allMaleValues);
    const globalMinFemale = Math.min(...allFemaleValues);
    const globalMaxFemale = Math.max(...allFemaleValues);
    const valueRange = [globalMinMale, globalMaxMale, globalMinFemale, globalMaxFemale];

    // Filter data for "sex"
    const filteredData = data.filter(record => {
        return record.year === selectedYear &&
            record.education === "Total" &&
            record.birthplace === "Total" &&
            record[metric] != null &&
            record.sex != null;
    });

    // Map data to GeoJSON by country
    geoData.features.forEach(feature => {
        const countryData = filteredData.filter(d => d.country === feature.properties.name);
        feature.properties.metricValues = {
            male: countryData.find(d => d.sex === "Male")?.[metric] || null,
            female: countryData.find(d => d.sex === "Female")?.[metric] || null
        };
    });

    // Bivariate color scale 9x9
    const n = 3;
    const colors = schemes[0].colors;
    const xValues = filteredData.filter(d => d.sex === "Female").map(d => d[metric]);
    const yValues = filteredData.filter(d => d.sex === "Male").map(d => d[metric]);

    const xScale = d3.scaleQuantile(xValues, d3.range(n));
    const yScale = d3.scaleQuantile(yValues, d3.range(n));

    const color = (values) => {
        if (!values || values.female == null || values.male == null) {
            return "url(#missing-data-pattern)";
        };
        const x = xScale(values.female);
        const y = yScale(values.male);
        return colors[y * n + x];
    };

    // Define missing data texture
    const defs = svg.append("defs");

    const pattern = defs.append("pattern")
        .attr("id", "missing-data-pattern")
        .attr("width", 8)  // Adjust pattern spacing
        .attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse");

    // Add lines to the pattern
    pattern.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", 4).attr("y2", 4)
        .attr("stroke", "#555")
            .attr("stroke-width", 0.5);

    // Clear the existing map
    mapGroup.selectAll(".country").remove();

    d3.selectAll(".maptooltip").remove();
    const tooltip = d3.select("body").append("div")
    .attr("class", "maptooltip");

    // Draw the map
    mapGroup.selectAll(".country")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", d => color(d.properties.metricValues))
        .on("mouseover", function (event, d) {
            d3.select(this)
                .style("stroke-width", "2")
                .style("stroke", "#000");

            // Call the tooltip function
            tooltipBarchart(tooltip, event, d, metric, selectedYear, valueRange, c10, c01, "sex");
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function () {
            d3.select(this)
                .style("stroke-width", "0.5")
                .style("stroke", "#000");

            // Hide tooltip
            tooltip.style("display", "none");
        })
        .on("click", function (event, d) {
            const [[x0, y0], [x1, y1]] = path.bounds(d);
            const countryWidth = x1 - x0;
            const countryHeight = y1 - y0;

            const scale = Math.min(8, 0.9 / Math.max(countryWidth / 960, countryHeight / 600));
            const translate = [
                960 / 2 - scale * (x0 + x1) / 2,
                600 / 2 - scale * (y0 + y1) / 2,
            ];

            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
        });

    // Add a double-click event to reset zoom
    svg.on("dblclick", function () {
        svg.transition().duration(750).call(zoom.transform, defaultTransform);
    });

    // legend for this bivariate choropleth
    mapLegend2BySex(svg, n, colors, valueRange, metric);
}

function drawMap2ByBirthplace(data, geoData, metric, selectedYear, mapGroup, path, svg, zoom, defaultTransform) {
    console.log("Drawing bivariate map by birthplace with", metric);

    const c00 = [240, 240, 240]; // Top-left corner white
    const c01 = [54, 132, 235];   // Top-right corner blue - foreign
    const c10 = [224, 61, 61]; // Bottom-left corner red - native
    const c11 = [64, 45, 87];    // Bottom-right corner purple

    const colormatrix = bivariateColorScale(c00, c01, c10, c11);
    // Color schemes
    const schemes = [
        {
            name: "RdBu",
            colors: colormatrix
        }
    ];

    // Calculate global min and max, in birthplace groups
    const allNativeValues = data.filter(d => 
        d.birthplace === "Native" && 
        d[metric] != null &&
        d.education === "Total" &&
        d.sex === "Total").map(d => d[metric]);
    const allForeignValues = data.filter(d => 
        d.birthplace === "Foreign" && 
        d[metric] != null &&
        d.education === "Total" &&
        d.sex === "Total").map(d => d[metric]);
    const globalMinNative = Math.min(...allNativeValues);
    const globalMaxNative = Math.max(...allNativeValues);
    const globalMinForeign = Math.min(...allForeignValues);
    const globalMaxForeign= Math.max(...allForeignValues);
    const valueRange = [globalMinNative, globalMaxNative, globalMinForeign, globalMaxForeign];

    // Filter data for "birthplace"
    const filteredData = data.filter(record => {
        return record.year === selectedYear &&
            record.education === "Total" &&
            record.sex === "Total" &&
            record[metric] != null &&
            record.birthplace != null;
    });

    // Map data to GeoJSON by country
    geoData.features.forEach(feature => {
        const countryData = filteredData.filter(d => d.country === feature.properties.name);
        feature.properties.metricValues = {
            native: countryData.find(d => d.birthplace === "Native")?.[metric] || null,
            foreign: countryData.find(d => d.birthplace === "Foreign")?.[metric] || null
        };
    });

    // Bivariate color scale 9x9
    const n = 3;
    const colors = schemes[0].colors;
    const xValues = filteredData.filter(d => d.birthplace === "Foreign").map(d => d[metric]);
    const yValues = filteredData.filter(d => d.birthplace === "Native").map(d => d[metric]);

    const xScale = d3.scaleQuantile(xValues, d3.range(n));
    const yScale = d3.scaleQuantile(yValues, d3.range(n));

    const color = (values) => {
        if (!values || values.foreign == null || values.native == null) {
            return "url(#missing-data-pattern)";
        };
        const x = xScale(values.foreign);
        const y = yScale(values.native);
        return colors[y * n + x];
    };

    // Define missing data texture
    const defs = svg.append("defs");

    const pattern = defs.append("pattern")
        .attr("id", "missing-data-pattern")
        .attr("width", 8)  // Adjust pattern spacing
        .attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse");

    // Add lines to the pattern
    pattern.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", 4).attr("y2", 4)
        .attr("stroke", "#555")
        .attr("stroke-width", 0.5);

    // Clear the existing map
    mapGroup.selectAll(".country").remove();

    // Create tooltip element
    d3.selectAll(".maptooltip").remove();
    const tooltip = d3.select("body").append("div")
        .attr("class", "maptooltip");

    // Draw the map
    mapGroup.selectAll(".country")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", d => color(d.properties.metricValues))
        .on("mouseover", function (event, d) {
            d3.select(this)
                .style("stroke-width", "2")
                .style("stroke", "#000");

            // Call the tooltip function
            tooltipBarchart(tooltip, event, d, metric, selectedYear, valueRange, c10, c01, "birthplace");
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function () {
            d3.select(this)
                .style("stroke-width", "0.5")
                .style("stroke", "#000");

            // Hide tooltip
            tooltip.style("display", "none");
        })
        .on("click", function (event, d) {
            const [[x0, y0], [x1, y1]] = path.bounds(d);
            const countryWidth = x1 - x0;
            const countryHeight = y1 - y0;

            const scale = Math.min(8, 0.9 / Math.max(countryWidth / 960, countryHeight / 600));
            const translate = [
                960 / 2 - scale * (x0 + x1) / 2,
                600 / 2 - scale * (y0 + y1) / 2,
            ];

            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
        });

    // Add a double-click event to reset zoom
    svg.on("dblclick", function () {
        svg.transition().duration(750).call(zoom.transform, defaultTransform);
    });

    // Pass the value range to the legend function
    mapLegend2ByBirthplace(svg, n, colors, valueRange, metric);
}

function mapLegend2BySex(svg, n, colors, valueRange, metric) {
    mapLegend2(svg, n, colors, ["Male", "Female"], valueRange, metric);
}

function mapLegend2ByBirthplace(svg, n, colors, valueRange, metric) {
    mapLegend2(svg, n, colors, ["Native", "Foreign"], valueRange, metric);
}

function mapLegend2(svg, n, colors, labels, valueRange, metric) {
    // legend for bivariate choropleth
    const k = 24;  // Size of each square in the legend
    const legendSize = k * n;  // Total size of the legend

    // console.log(labels);
    // console.log(valueRange);

    // Remove any existing legend
    svg.selectAll("#legend-group").remove();
    svg.selectAll("#legend-gradient").remove();
    svg.selectAll("#legend-compare").remove();

    // Create the legend group
    const legendGroup = svg.append("g")
        .attr("id", "bivariate-legend")
        .attr("transform", `translate(120, 80)`);

    const legend = legendGroup.append("g")
        .attr("transform", `translate(-${legendSize / 2}, -${legendSize / 2}) rotate(-45 ${legendSize / 2}, ${legendSize / 2})`);

    // Add the color squares
    legend.selectAll("rect")
        .data(d3.cross(d3.range(n), d3.range(n)))
        .enter()
        .append("rect")
        .attr("width", k)
        .attr("height", k)
        .attr("x", ([i]) => i * k)
        .attr("y", ([, j]) => (n - 1 - j) * k)
        .attr("fill", ([i, j]) => colors[j * n + i]);

    // line ↖
    legendGroup.append("line")
        .attr("x1", 0)
        .attr("y1", legendSize)
        .attr("x2", -legendSize)
        .attr("y2", 0)
        .attr("stroke", "black")
        .attr("stroke-width", 1.5);

    // line ↗
    legendGroup.append("line")
        .attr("x1", 0)
        .attr("y1", legendSize)
        .attr("x2", legendSize)
        .attr("y2", 0)
        .attr("stroke", "black")
        .attr("stroke-width", 1.5);

    // Label line ↖
    legendGroup.append("text")
        .attr("x", legendSize - 137)
        .attr("y", legendSize / 2 + 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(labels[0]);  // male, native

    // Label line ↗
    legendGroup.append("text")
        .attr("x", legendSize)
        .attr("y", legendSize / 2 + 5)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .text(labels[1]);  // female, foreign

    // Values ↖
    legendGroup.append("text")
        .attr("x", -30)
        .attr("y", legendSize)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text(valueRange[0].toFixed(2));  // male, native min
    legendGroup.append("text")
        .attr("x", -90)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text(valueRange[1].toFixed(2));  // male, native max
    
    // Values ↗
    legendGroup.append("text")
        .attr("x", +30)
        .attr("y", legendSize)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text(valueRange[2].toFixed(2));  // female, foreign min
    legendGroup.append("text")
        .attr("x", +90)
        .attr("y", 0)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text(valueRange[3].toFixed(2));  // female, foreign max
    
    // Metric descriptions
    const metricDescriptions = {
        "workpopK": "Working age population",
        "labourR": "Labour force participation rate",
        "employR": "Employment to population ratio",
        "unemployR": "Unemployment rate",
        "earning": "Average monthly earning"
    };

    // Determine the unit
    let unit = "";
    if (metric === "workpopK") {
        unit = "thousand";
    } else if (metric === "earning") {
        unit = "$";
    } else {
        unit = "%";
    }

    // Get the label for the current metric
    const metricLabel = metricDescriptions[metric] || metric;

    // Append the title with the label and unit
    legendGroup.append("text")
        .attr("x", 0)
        .attr("y", - legendSize / 2 * 1.618)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        // .text(`${metric} (${unit})`);
        .text(`${metricLabel} (${unit})`);
}

function tooltipBarchart(tooltip, event, d, metric, selectedYear, valueRange, cPrimary, cSecondary, category) {
    // to show a tiny barchart in tooltips

    // Determine labels and values based on the category
    const primaryLabel = category === "sex" ? "Male" : "Native";
    const secondaryLabel = category === "sex" ? "Female" : "Foreign";

    // Dynamically select the correct values based on the category
    const primaryValue = category === "sex" ? d.properties.metricValues?.male : d.properties.metricValues?.native;
    const secondaryValue = category === "sex" ? d.properties.metricValues?.female : d.properties.metricValues?.foreign;

    // Convert RGB arrays to color strings
    const primaryColor = `rgb(${cPrimary[0]}, ${cPrimary[1]}, ${cPrimary[2]})`;
    const secondaryColor = `rgb(${cSecondary[0]}, ${cSecondary[1]}, ${cSecondary[2]})`;

    // metric labels
    const metricLabels = {
        workpopK: "Working age population (thousands)",
        labourR: "Labour force participation rate (%)",
        employR: "Employment to population ratio (%)",
        unemployR: "Unemployment rate (%)",
        earning: "Average monthly earning ($)"
    };

    // Show tooltip
    tooltip.style("display", "block")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");

    // Clear any existing content inside the tooltip
    tooltip.html("");

    // Add a title to the tooltip
    tooltip.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "5px")
        .text(`${d.properties.name}, ${selectedYear}`);

    // Add the metric names
    tooltip.append("div")
        .style("margin-bottom", "10px")
        .text(metricLabels[metric] || ""); // Fallback to empty string if metric not found

    // Add an SVG for the bar chart
    const chartWidth = 100;
    const chartHeight = 50;
    const margin = { top: 20, right: 10, bottom: 20, left: 10 };
    const barWidth = 30;

    const svgChart = tooltip.append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Scales for the bar chart
    const yScale = d3.scaleLinear()
        .domain([valueRange[0], valueRange[1]]) // Use global min and max values
        .range([chartHeight, 0]);

    // Draw bars
    svgChart.append("rect")
        .attr("x", 10) // Position of the first bar
        .attr("y", primaryValue != null ? yScale(primaryValue) : chartHeight)
        .attr("width", barWidth)
        .attr("height", primaryValue != null ? chartHeight - yScale(primaryValue) : 0)
        .attr("fill", primaryColor);

    svgChart.append("rect")
        .attr("x", 60) // Position of the second bar
        .attr("y", secondaryValue != null ? yScale(secondaryValue) : chartHeight)
        .attr("width", barWidth)
        .attr("height", secondaryValue != null ? chartHeight - yScale(secondaryValue) : 0)
        .attr("fill", secondaryColor);

    // Add y-axis labels for the bars
    svgChart.append("text")
        .attr("x", 10 + barWidth / 2)  // first bar label
        .attr("y", chartHeight + 15)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text(primaryLabel);

    svgChart.append("text")
        .attr("x", 60 + barWidth / 2)  // second bar label
        .attr("y", chartHeight + 15)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text(secondaryLabel);
    
    // Add value on top of bars
    svgChart.append("text")
        .attr("x", 10 + barWidth / 2)  // first bar value
        .attr("y", primaryValue != null ? yScale(primaryValue) - 5 : chartHeight - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", primaryColor)
        .text(primaryValue != null ? primaryValue.toFixed(2) : "No data");

    svgChart.append("text")
        .attr("x", 60 + barWidth / 2)  // second bar value
        .attr("y", secondaryValue != null ? yScale(secondaryValue) - 5 : chartHeight - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", secondaryColor)
        .text(secondaryValue != null ? secondaryValue.toFixed(2) : "No data");
}





function drawMapC(data, geoData, metric, category, selectedYear, mapGroup, path, svg, zoom, defaultTransform) {
    console.log("Drawing comparison map");

    // Remove existing legend (if any)
    svg.selectAll("#legend-group").remove();
    svg.selectAll("#bivariate-legend").remove();
    svg.selectAll("#legend-compare").remove();

    if (category === "sexC") {
        drawMapCBySex(data, geoData, metric, selectedYear, mapGroup, path, svg, zoom, defaultTransform);
    } else if (category === "birthplaceC") {
        drawMapCByBirthplace(data, geoData, metric, selectedYear, mapGroup, path, svg, zoom, defaultTransform);
    }
}

function drawMapCBySex(data, geoData, metric, selectedYear, mapGroup, path, svg, zoom, defaultTransform) {
    console.log("Drawing comparison map by sex with", metric);

    // Calculate global min and max, this is for the barchart inside tooltips
    const allMaleValues = data.filter(d => 
        d.sex === "Male" && 
        d[metric] != null &&
        d.education === "Total" &&
        d.birthplace === "Total").map(d => d[metric]);
    const allFemaleValues = data.filter(d => 
        d.sex === "Female" && 
        d[metric] != null &&
        d.education === "Total" &&
        d.birthplace === "Total").map(d => d[metric]);
    const globalMinMale = Math.min(...allMaleValues);
    const globalMaxMale = Math.max(...allMaleValues);
    const globalMinFemale = Math.min(...allFemaleValues);
    const globalMaxFemale = Math.max(...allFemaleValues);
    const valueRangeAll = [globalMinMale, globalMaxMale, globalMinFemale, globalMaxFemale];

    // Calculate global min and max ratios
    const ratioDataGlobal = {};
    data.forEach(record => {
        const key = `${record.country}-${record.year}`;
        if (!ratioDataGlobal[key]) ratioDataGlobal[key] = {};

        if (record.sex === "Male" && record.education === "Total" && record.birthplace === "Total") {
            ratioDataGlobal[key].male = record[metric];
        } else if (record.sex === "Female" && record.education === "Total" && record.birthplace === "Total") {
            ratioDataGlobal[key].female = record[metric];
        }
    });

    // Calculate global min, max, and median ratios
    const allRatios = Object.values(ratioDataGlobal)
        .filter(d => d.male != null && d.female != null) // Ensure both values exist
        .map(d => d.male / d.female); // Calculate ratios

    const globalMinRatio = Math.min(...allRatios);
    const globalMaxRatio = Math.max(...allRatios);

    // Calculate median ratio
    const sortedRatios = allRatios.slice().sort((a, b) => a - b); // Sort a copy of the array
    const middle = Math.floor(sortedRatios.length / 2);
    const globalMedianRatio = 
        sortedRatios.length % 2 === 0 
            ? (sortedRatios[middle - 1] + sortedRatios[middle]) / 2 
            : sortedRatios[middle];

    // console.log("Global min/median/max ratio:", globalMinRatio, globalMedianRatio, globalMaxRatio);

    // Filter data for the selected year
    const filteredData = data.filter(record => {
        return (
            record.year === selectedYear &&
            record.education === "Total" &&
            record.birthplace === "Total" &&
            record[metric] != null &&
            record.sex != null &&
            record.sex !== "Total" // Exclude 'Total' rows
        );
    });

    // Reset GeoJSON properties
    geoData.features.forEach(feature => {
        feature.properties.metricValue = null; // Clear previous metricValue
    });

    // Calculate the male-to-female ratio for the selected year
    const ratioData = {};
    filteredData.forEach(record => {
        const key = `${record.country}-${record.year}`;
        if (!ratioData[key]) ratioData[key] = {};

        if (record.sex === "Male") {
            ratioData[key].male = record[metric];
        } else if (record.sex === "Female") {
            ratioData[key].female = record[metric];
        }
    });

    // Map the calculated ratios to GeoJSON features
    geoData.features.forEach(feature => {
        const key = `${feature.properties.name}-${selectedYear}`;
        if (ratioData[key] && ratioData[key].male != null && ratioData[key].female != null) {
            feature.properties.metricValue = ratioData[key].male / ratioData[key].female;
            feature.properties.maleValue = ratioData[key].male;
            feature.properties.femaleValue = ratioData[key].female;
        }
    });

    // Define missing data texture
    const defs = svg.append("defs");

    const pattern = defs.append("pattern")
        .attr("id", "missing-data-pattern")
        .attr("width", 8)
        .attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse");

    pattern.append("line")
        .attr("x1", 0)
        .attr("y1", 0)
        .attr("x2", 4)
        .attr("y2", 4)
        .attr("stroke", "#555")
        .attr("stroke-width", 0.5);

    // Define a diverging color scale with global range
    const colorC = ["rgb(222, 89, 146)", "white", "rgb(68, 189, 219)"];
    const colorScale = d3.scaleDiverging()
        .domain([globalMinRatio, globalMedianRatio, globalMaxRatio]) // Use global range
        .interpolator(d3.interpolateRgbBasis(colorC)); // Custom color interpolation

    // Clear the existing map
    mapGroup.selectAll(".country").remove();

    // Create a tooltip using the `maptooltip` class
    d3.selectAll(".maptooltip").remove();
    const tooltip = d3.select("body").append("div")
        .attr("class", "maptooltip");

    // Draw the map
    mapGroup.selectAll(".country")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", d => {
            const value = d.properties.metricValue;
            return value != null ? colorScale(value) : "url(#missing-data-pattern)";
        })
        .style("pointer-events", "all")
        .on("mouseover", function (event, d) {
            d3.select(this)
                .style("stroke-width", "2")
                .style("stroke", "#000");
        
            // Extract values for male and female
            const maleValue = d.properties.maleValue;
            const femaleValue = d.properties.femaleValue;
        
            // Call the tooltip function
            tooltipBarchartC(
                tooltip,
                event,
                {
                    primaryValue: maleValue,
                    secondaryValue: femaleValue,
                    name: d.properties.name, // Country name
                    year: selectedYear, // Current year
                },
                metric,
                valueRangeAll, // Global min and max for male and female values
                [68, 189, 219], // Blue for Male
                [222, 89, 146], // Red for Female
                "sex" // Category
            );
        })
        .on("mousemove", function (event) {
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function () {
            d3.select(this)
                .style("stroke-width", "0.5")
                .style("stroke", "#000");

            // Hide tooltip
            tooltip.style("display", "none");
        })
        .on("click", function (event, d) {
            const [[x0, y0], [x1, y1]] = path.bounds(d);
            const countryWidth = x1 - x0;
            const countryHeight = y1 - y0;

            const scale = Math.min(8, 0.9 / Math.max(countryWidth / 960, countryHeight / 600));
            const translate = [
                960 / 2 - scale * (x0 + x1) / 2,
                600 / 2 - scale * (y0 + y1) / 2,
            ];

            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
        });

    // Add a double-click event to reset zoom
    svg.on("dblclick", function () {
        svg.transition().duration(750).call(zoom.transform, defaultTransform); // Reset zoom
    });

    // Update the legend with global range
    const valueRange = [globalMinRatio, globalMedianRatio, globalMaxRatio];
    mapLegendC(svg, colorC, metric, "Male/Female Ratio", valueRange);
}

function drawMapCByBirthplace(data, geoData, metric, selectedYear, mapGroup, path, svg, zoom, defaultTransform) {
    console.log("Drawing comparison map by birthplace with", metric);

    // Calculate global min and max for all years and birthplace
    const allNativeValues = data.filter(d => 
        d.birthplace === "Native" && 
        d[metric] != null &&
        d.education === "Total" &&
        d.sex === "Total").map(d => d[metric]);
    const allForeignValues = data.filter(d => 
        d.birthplace === "Foreign" && 
        d[metric] != null &&
        d.education === "Total" &&
        d.sex === "Total").map(d => d[metric]);
    const globalMinNative = Math.min(...allNativeValues);
    const globalMaxNative = Math.max(...allNativeValues);
    const globalMinForeign = Math.min(...allForeignValues);
    const globalMaxForeign= Math.max(...allForeignValues);
    const valueRangeAll = [globalMinNative, globalMaxNative, globalMinForeign, globalMaxForeign];

    // Calculate global min, max, and median ratios across all years
    const ratioDataGlobal = {};
    data.forEach(record => {
        const key = `${record.country}-${record.year}`;
        if (!ratioDataGlobal[key]) ratioDataGlobal[key] = {};

        if (record.birthplace === "Native" && record.education === "Total" && record.sex === "Total") {
            ratioDataGlobal[key].native = record[metric];
        } else if (record.birthplace === "Foreign" && record.education === "Total" && record.sex === "Total") {
            ratioDataGlobal[key].foreign = record[metric];
        }
    });

    const allRatios = Object.values(ratioDataGlobal)
        .filter(d => d.native != null && d.foreign != null) // Ensure both values exist
        .map(d => d.native / d.foreign); // Calculate ratios

    const globalMinRatio = Math.min(...allRatios);
    const globalMaxRatio = Math.max(...allRatios);

    // Calculate median
    const sortedRatios = allRatios.slice().sort((a, b) => a - b); // Sort the ratios
    const middle = Math.floor(sortedRatios.length / 2);
    const globalMedianRatio =
        sortedRatios.length % 2 === 0
            ? (sortedRatios[middle - 1] + sortedRatios[middle]) / 2
            : sortedRatios[middle];

    // console.log("Global min/median/max ratio:", globalMinRatio, globalMedianRatio, globalMaxRatio);

    // Filter data for the selected year
    const filteredData = data.filter(record => {
        return (
            record.year === selectedYear &&
            record.education === "Total" &&
            record.sex === "Total" &&
            record[metric] != null &&
            record.birthplace != null &&
            record.birthplace !== "Total" // Exclude 'Total' rows
        );
    });

    // Reset GeoJSON properties
    geoData.features.forEach(feature => {
        feature.properties.metricValue = null; // Clear previous metricValue
        feature.properties.nativeValue = null; // Clear previous native value
        feature.properties.foreignValue = null; // Clear previous foreign value
    });

    // Calculate the native-to-foreign ratio for the selected year
    const ratioData = {};
    filteredData.forEach(record => {
        const key = `${record.country}-${record.year}`;
        if (!ratioData[key]) ratioData[key] = {};

        if (record.birthplace === "Native") {
            ratioData[key].native = record[metric];
        } else if (record.birthplace === "Foreign") {
            ratioData[key].foreign = record[metric];
        }
    });

    // Map the calculated ratios and raw values (native and foreign) to GeoJSON features
    geoData.features.forEach(feature => {
        const key = `${feature.properties.name}-${selectedYear}`;
        if (ratioData[key] && ratioData[key].native != null && ratioData[key].foreign != null) {
            feature.properties.nativeValue = ratioData[key].native; // Store native value
            feature.properties.foreignValue = ratioData[key].foreign; // Store foreign value
            feature.properties.metricValue = ratioData[key].native / ratioData[key].foreign; // Calculate and store the ratio
        } else {
            feature.properties.nativeValue = null; // Ensure null for missing data
            feature.properties.foreignValue = null;
            feature.properties.metricValue = null;
        }
    });

    // Define missing data texture
    const defs = svg.append("defs");

    const pattern = defs.append("pattern")
        .attr("id", "missing-data-pattern")
        .attr("width", 8)  // Adjust pattern spacing
        .attr("height", 8)
        .attr("patternUnits", "userSpaceOnUse");

    // Add lines to the pattern
    pattern.append("line")
        .attr("x1", 0).attr("y1", 0)
        .attr("x2", 4).attr("y2", 4)
        .attr("stroke", "#555")
        .attr("stroke-width", 0.5);

    // Define a diverging color scale using global min, median, and max ratios
    const colorC = ["rgb(54, 132, 235)", "white", "rgb(224, 61, 61)"];
    const colorScale = d3.scaleDiverging()
        .domain([globalMinRatio, globalMedianRatio, globalMaxRatio]) // Use global min, median, and max
        .interpolator(d3.interpolateRgbBasis(colorC)); // Custom color interpolation

    // Clear the existing map
    mapGroup.selectAll(".country").remove();

    // Create a tooltip using the `maptooltip` class
    d3.selectAll(".maptooltip").remove();
    const tooltip = d3.select("body").append("div")
        .attr("class", "maptooltip");

    // Draw the map
    mapGroup.selectAll(".country")
        .data(geoData.features)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path)
        .attr("fill", d => {
            const value = d.properties.metricValue;
            return value != null ? colorScale(value) : "url(#missing-data-pattern)";
        })
        .style("pointer-events", "all")
        .on("mouseover", function (event, d) {
            d3.select(this)
                .style("stroke-width", "2")
                .style("stroke", "#000");
        
            // Extract values for native and foreign
            const nativeValue = d.properties.nativeValue;
            const foreignValue = d.properties.foreignValue;
        
            // Call the tooltip function to visualize native and foreign values
            tooltipBarchartC(
                tooltip,
                event,
                {
                    primaryValue: nativeValue,
                    secondaryValue: foreignValue,
                    name: d.properties.name, // Country name
                    year: selectedYear, // Current year
                },
                metric,
                valueRangeAll, // Global min and max for male and female values
                [224, 61, 61], // Red for Native
                [54, 132, 235], // Blue for Foreign
                "birthplace" // Category
            );
        })        
        .on("mousemove", function (event) {
            // Update tooltip position dynamically
            tooltip.style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function () {
            d3.select(this)
                .style("stroke-width", "0.5")
                .style("stroke", "#000");

            // Hide tooltip
            tooltip.style("display", "none");
        })
        .on("click", function (event, d) {
            const [[x0, y0], [x1, y1]] = path.bounds(d); // Get bounding box of the country
            const countryWidth = x1 - x0;
            const countryHeight = y1 - y0;

            const scale = Math.min(8, 0.9 / Math.max(countryWidth / 960, countryHeight / 600));
            const translate = [
                960 / 2 - scale * (x0 + x1) / 2,
                600 / 2 - scale * (y0 + y1) / 2,
            ];

            svg.transition().duration(750).call(
                zoom.transform,
                d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
            );
        });

    // Add a double-click event to reset zoom
    svg.on("dblclick", function () {
        svg.transition().duration(750).call(zoom.transform, defaultTransform); // Reset zoom
    });

    // Update the legend with global range
    const valueRange = [globalMinRatio, globalMedianRatio, globalMaxRatio];
    mapLegendC(svg, colorC, metric, "Native/Foreign Ratio", valueRange);
}

function mapLegendC(svg, colorC, metric, title, valueRange) {
    const legendWidth = 300;
    const legendHeight = 20;
    const [minValue, medianValue, maxValue] = valueRange;

    svg.select("#legend-compare").remove();

    const legendGroup = svg.append("g")
        .attr("id", "legend-compare")
        .attr("transform", `translate(10, 40)`); // Position of the legend

    // Gradient definition for the legend
    let defs = svg.select("defs");
    if (defs.empty()) {
        defs = svg.append("defs");
    }

    // Define just the gradient for the legend
    let gradient = defs.select("#legend-gradient");
    if (!gradient.empty()) {
      gradient.remove(); 
    }

    gradient = defs.append("linearGradient")
        .attr("id", "legend-gradient")
        .attr("x1", "0%")
        .attr("x2", "100%");

    // Define stops for the gradient based on min, median, and max
    gradient.append("stop")
        .attr("offset", "0%")
        .attr("stop-color", colorC[0]); // Low value (red)
    gradient.append("stop")
        .attr("offset", "50%") // Median at 50%
        .attr("stop-color", "white"); // Median (white)
    gradient.append("stop")
        .attr("offset", "100%")
        .attr("stop-color", colorC[2]); // High value (blue)

    // Draw the legend gradient
    legendGroup.append("rect")
        .attr("width", legendWidth)
        .attr("height", legendHeight)
        .style("fill", "url(#legend-gradient)");

    // Create a custom scale for the axis
    const legendScale = d3.scaleLinear()
        .domain([minValue, ]) // Domain from min to max
        .range([0, legendWidth]); // Map to legend width

    // Draw ticks manually
    const tickValues = [minValue, medianValue, maxValue]; // Explicit tick positions
    const tickPositions = [0, 150, 300];

    // Draw ticks manually
    tickPositions.forEach((position, index) => {
        // Draw the tick line
        legendGroup.append("line")
            .attr("x1", position)
            .attr("x2", position)
            .attr("y1", legendHeight)
            .attr("y2", legendHeight +10) // Extend slightly below the legend
            .style("stroke", "black")
            .style("stroke-width", 1);

        // Add the tick label
        legendGroup.append("text")
            .attr("x", position)
            .attr("y", legendHeight + 20) // Position below the tick line
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .text(tickValues[index].toFixed(2)); // Format the value to 2 decimal places
    });

    // Add a title for the legend
    legendGroup.append("text")
        .attr("x", legendWidth / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("font-weight", "bold")
        .text(title);
}

function tooltipBarchartC(tooltip, event, data, metric, valueRange, cPrimary, cSecondary, category) {
    const { primaryValue, secondaryValue, name, year } = data;

    // Determine labels based on the category
    const primaryLabel = category === "sex" ? "Male" : "Native";
    const secondaryLabel = category === "sex" ? "Female" : "Foreign";

    // Convert RGB arrays to color strings
    const primaryColor = `rgb(${cPrimary[0]}, ${cPrimary[1]}, ${cPrimary[2]})`;
    const secondaryColor = `rgb(${cSecondary[0]}, ${cSecondary[1]}, ${cSecondary[2]})`;

    // Metric units
    const metricLabels = {
        workpopK: "Working age population (thousands)",
        labourR: "Labour force participation rate (%)",
        employR: "Employment to population ratio (%)",
        unemployR: "Unemployment rate (%)",
        earning: "Average monthly earning ($)"
    };

    // Show tooltip
    tooltip.style("display", "block")
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px");

    // Clear any existing content inside the tooltip
    tooltip.html("");

    // Add a title to the tooltip
    tooltip.append("div")
        .style("font-weight", "bold")
        .style("margin-bottom", "5px")
        .text(`${name}, ${year}`);

    // Add a dynamic unit label based on the metric
    tooltip.append("div")
        .style("margin-bottom", "10px")
        .text(metricLabels[metric] || ""); // Fallback to empty string if metric not found

    // Add an SVG for the bar chart
    const chartWidth = 100;
    const chartHeight = 50;
    const margin = { top: 20, right: 10, bottom: 20, left: 10 };
    const barWidth = 30;

    const svgChart = tooltip.append("svg")
        .attr("width", chartWidth + margin.left + margin.right)
        .attr("height", chartHeight + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Scales for the bar chart
    const yScale = d3.scaleLinear()
        .domain([Math.min(...valueRange), Math.max(...valueRange)]) // Use global min and max values
        .range([chartHeight, 0]);

    // Draw primary bar
    svgChart.append("rect")
        .attr("x", 10) // Position of the first bar
        .attr("y", primaryValue != null ? yScale(primaryValue) : chartHeight)
        .attr("width", barWidth)
        .attr("height", primaryValue != null ? chartHeight - yScale(primaryValue) : 0)
        .attr("fill", primaryColor);

    // Draw secondary bar
    svgChart.append("rect")
        .attr("x", 60) // Position of the second bar
        .attr("y", secondaryValue != null ? yScale(secondaryValue) : chartHeight)
        .attr("width", barWidth)
        .attr("height", secondaryValue != null ? chartHeight - yScale(secondaryValue) : 0)
        .attr("fill", secondaryColor);

    // Add labels for the bars
    svgChart.append("text")
        .attr("x", 10 + barWidth / 2)
        .attr("y", chartHeight + 15)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text(primaryLabel);

    svgChart.append("text")
        .attr("x", 60 + barWidth / 2)
        .attr("y", chartHeight + 15)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .text(secondaryLabel);

    // Add values above the bars
    svgChart.append("text")
        .attr("x", 10 + barWidth / 2)
        .attr("y", primaryValue != null ? yScale(primaryValue) - 5 : chartHeight - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", primaryColor)
        .text(primaryValue != null ? primaryValue.toFixed(2) : "No data");

    svgChart.append("text")
        .attr("x", 60 + barWidth / 2)
        .attr("y", secondaryValue != null ? yScale(secondaryValue) - 5 : chartHeight - 5)
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", secondaryColor)
        .text(secondaryValue != null ? secondaryValue.toFixed(2) : "No data");
}








/**
 * from https://observablehq.com/@mbostock/scrubber
 */
function Scrubber(values, { 
    format = value => value,
    initial = 0,
    direction = 1,
    delay = null,
    autoplay = true,
    loop = true,
    loopDelay = null,
    alternate = false
} = {}) {
    values = Array.from(values);

    // Create the form element and its children
    const form = document.createElement("form");
    form.style.cssText = "font: 12px sans-serif; font-variant-numeric: tabular-nums; display: flex; height: 33px; align-items: center;";

    const button = document.createElement("button");
    button.name = "b";
    button.type = "button";
    button.style.cssText = "margin-right: 0.4em; width: 5em;";
    form.appendChild(button);

    const label = document.createElement("label");
    label.style.cssText = "display: flex; align-items: center;";
    form.appendChild(label);

    const input = document.createElement("input");
    input.name = "i";
    input.type = "range";
    input.min = 0;
    input.max = values.length - 1;
    input.value = initial;
    input.step = 1;
    input.style.width = "180px";
    label.appendChild(input);

    const output = document.createElement("output");
    output.name = "o";
    output.style.marginLeft = "0.4em";
    label.appendChild(output);

    // Define variables for playback
    let frame = null;
    let timer = null;
    let interval = null;

    function start() {
        button.textContent = "Pause";
        if (delay === null) frame = requestAnimationFrame(tick);
        else interval = setInterval(tick, delay);
    }

    function stop() {
        button.textContent = "Play";
        if (frame !== null) cancelAnimationFrame(frame), frame = null;
        if (timer !== null) clearTimeout(timer), timer = null;
        if (interval !== null) clearInterval(interval), interval = null;
    }

    function running() {
        return frame !== null || timer !== null || interval !== null;
    }

    function tick() {
        if (input.valueAsNumber === (direction > 0 ? values.length - 1 : direction < 0 ? 0 : NaN)) {
            if (!loop) return stop();
            if (alternate) direction = -direction;
            if (loopDelay !== null) {
                if (frame !== null) cancelAnimationFrame(frame), frame = null;
                if (interval !== null) clearInterval(interval), interval = null;
                timer = setTimeout(() => (step(), start()), loopDelay);
                return;
            }
        }
        if (delay === null) frame = requestAnimationFrame(tick);
        step();
    }

    function step() {
        input.valueAsNumber = (input.valueAsNumber + direction + values.length) % values.length;
        input.dispatchEvent(new CustomEvent("input", {bubbles: true}));
    }

    input.oninput = event => {
        if (event && event.isTrusted && running()) stop();
        form.value = values[input.valueAsNumber];
        output.value = format(form.value, input.valueAsNumber, values);
    };

    button.onclick = () => {
        if (running()) return stop();
        direction = alternate && input.valueAsNumber === values.length - 1 ? -1 : 1;
        input.valueAsNumber = (input.valueAsNumber + direction) % values.length;
        input.dispatchEvent(new CustomEvent("input", {bubbles: true}));
        start();
    };

    input.oninput();
    if (autoplay) start();
    else stop();

    return form;
}