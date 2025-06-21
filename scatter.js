function drawScatter(DATA0) {
	console.log("drawScatter");

	// Filter the data
	let data = DATA0.filter(d =>
		d.birthplace !== "Status unknown" &&
		d.education !== "Level not stated" &&
		d.labourR != null &&
		d.labourR < 100 &&
		d.unemployR != null &&
		d.unemployR < 100
	);

	// Colors
	let color_sex = { "Male": "rgb(68, 189, 219)", "Female": "rgb(255, 97, 208)" };
	let color_birp = { "Native": "rgb(224, 61, 61)", "Foreign": "rgb(54, 132, 235)" };
	let color_edu = { 
		// "Advanced": "#0f0059", 
		// "Intermediate": "#653396", 
		// "Basic": "#9b6aad", 
		// "Less than basic": "#ecd8f2" 
        "Advanced": "#4f00b0", 
		"Intermediate": "#001ae0", 
		"Basic": "#25b4db", 
		"Less than basic": "#32d996" 
	};
	let colors = [color_sex, color_birp, color_edu];

	// Define margins and dimensions
	const margin = { top: 50, right: 50, bottom: 50, left: 80 };
	const width = 1000 - margin.left - margin.right; // Inner width
	const height = 700 - margin.top - margin.bottom; // Inner height

	// Data for the buttons
	const options = ["Gender", "Birthplace", "Education"];

	// Append a container for the buttons inside #scatter-container
	const container = d3.select("#scatter-container")
		.append("div")
		.attr("class", "button-container");

	// Create buttons
	options.forEach(option => {
		// Append a label
		const label = container.append("label");

		// Append a checkbox input to simulate toggle behavior
		const checkbox = label.append("input")
			.attr("type", "checkbox")
			.attr("class", "toggle-button")
			.attr("value", option);

		// Set the default selection for "Gender"
		if (option === "Gender") {
			checkbox.property("checked", true);
		}

		// Append the text next to the button
		label.append("span")
			.text(option);

		// Add some spacing
		label.append("br");
	});

	// Append an SVG container for the scatter plot inside #scatter-container
	const svgContainer = d3.select("#scatter-container")
		.append("svg")
		.attr("width", 1000)
		.attr("height", 800)
		.attr("class", "scatter-plot");

	// Initial draw with "Gender" selected by default
	const selectedStates = {
		Gender: true,
		Birthplace: false,
		Education: false,
	};
	scatter1(data, selectedStates, svgContainer, colors, margin, width, height);

	// Add event listeners to the checkboxes
	d3.selectAll('.toggle-button').on("change", function () {
		// Read the updated state of all checkboxes
		const selectedStates = {
			Gender: d3.select('input[value="Gender"]').property("checked"),
			Birthplace: d3.select('input[value="Birthplace"]').property("checked"),
			Education: d3.select('input[value="Education"]').property("checked"),
		};

		// Get the number of selected checkboxes
		const selectedCount = Object.values(selectedStates).filter(state => state).length;

		// Clear the existing scatter plot before updating
		svgContainer.selectAll("*").remove();

		// Control logic based on the number of selected checkboxes
		if (selectedCount === 1) {
			scatter1(data, selectedStates, svgContainer, colors, margin, width, height);
		} else if (selectedCount === 2) {
			scatter2(data, selectedStates, svgContainer, colors, margin, width, height);
		} else if (selectedCount === 3) {
			scatter3(data, selectedStates, svgContainer, colors, margin, width, height);
		} else {
			console.log("No checkboxes selected, scatter plot not drawn.");
		}
	});
}

function titlelabel(svgContainer, margin, width, height) {
	svgContainer.selectAll(".axis-label").remove();
	svgContainer.selectAll(".title").remove();

    svgContainer.append("text")
        .attr("class", "axis-label")  // x
        .attr("x", margin.left + width / 2)
        .attr("y", margin.top + height + 40)
        .attr("text-anchor", "middle")
        .attr("font-size", "15px")
        .attr("fill", "black")
        .text("Labour Force Participation Rate %");

    svgContainer.append("text")
        .attr("class", "axis-label")  // y
        .attr("transform", `translate(${margin.left - 40}, ${margin.top + height / 2}) rotate(-90)`) // Rotate for y-axis
        .attr("text-anchor", "middle")
        .attr("font-size", "15px")
        .attr("fill", "black")
        .text("Unemployment Rate %");
	
	svgContainer.append("text")
        .attr("class", "title")
        .attr("x", margin.left + width / 2)
        .attr("y", margin.top -30)
        .attr("text-anchor", "middle")
        .attr("font-size", "24px")
        .attr("fill", "black")
        .text("Effort and Struggle");
}




 
function scatter1(data, selectedStates, svgContainer, colors, margin, width, height) {
    console.log("scatter1 called");

    // Create a global tooltip to be reused in scatter1 and scatter2
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip-scatter1")
        .style("position", "absolute")
        .style("background-color", "#fff")
        .style("border", "1px solid #ccc")
        .style("border-radius", "4px")
        .style("padding", "5px")
        .style("opacity", 0)
        .style("pointer-events", "none")
        .style("font-size", "12px");


    // Map the keys to their corresponding attributes
    const keyAttributeMap = {
        "Gender": "sex",
        "Birthplace": "birthplace",
        "Education": "education"
    };

    // Map the keys to their corresponding color schemes
    const keyColorMap = {
        "Gender": colors[0], // color_sex
        "Birthplace": colors[1], // color_birp
        "Education": colors[2] // color_edu
    };

    // Step 1: Identify the selected key and corresponding attribute and color map
    const selectedKey = Object.keys(selectedStates).find(key => selectedStates[key]);
    const selectedAttribute = keyAttributeMap[selectedKey];
    const selectedColorMap = keyColorMap[selectedKey];

    // Step 2: Filter data
    let filteredData = [];
    if (selectedKey) {
        // Get the attributes for the other two keys
        const otherKeys = Object.keys(keyAttributeMap).filter(key => key !== selectedKey);
        const otherKey1 = keyAttributeMap[otherKeys[0]];
        const otherKey2 = keyAttributeMap[otherKeys[1]];

        // Filter the data based on the selected and other keys
        filteredData = data.filter(d =>
            d[selectedAttribute] !== "Total" &&
            d[otherKey1] === "Total" &&
            d[otherKey2] === "Total"
        );
    } else {
        console.warn("No valid selection made for scatter1.");
        return;
    }

    // Step 3: Define scales
    const xScale = d3.scaleLinear()
		.domain([0, 100])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => d.unemployR) +1]) // Scale based on unemployR
        .range([height, 0]); // Inner height, flipped

    // Step 4: Define a clipPath to hide points outside the x-axis
    svgContainer.append("defs")
        .append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height);

    // Step 5: Add a group element for the plot area
    const plotArea = svgContainer.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Step 6: Add axes (outside the clipping path)
    const xAxisGroup = svgContainer.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top + height})`);
    const yAxisGroup = svgContainer.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    xAxisGroup.call(xAxis);
    yAxisGroup.call(yAxis);

    // Step 7: Add circles inside the clip path
    const clippedArea = plotArea.append("g")
        .attr("clip-path", "url(#clip)"); // Apply the clip path only to data points
    
    // Helper function to highlight glyphs of the same class & color
    function addHoverEffects(selection, className) {
        selection
            .on("mouseover", function (event, d) {
                const currentColor = d3.select(this).attr("fill");
            
            // Construct tooltip text while excluding "Total" from the displayed properties
            let tooltipText = [
                d.sex !== "Total" ? d.sex : null,
                d.birthplace !== "Total" ? d.birthplace : null,
                d.education !== "Total" ? d.education : null
            ].filter(value => value !== null).join(" - "); // Remove null values and join with "-"

            // Show tooltip only if there's relevant information
            tooltip
                .style("opacity", 1)
                .html(tooltipText); 
                // Highlight all glyphs with same class and color
                clippedArea.selectAll("." + className)
                    .filter(function () {
                        return d3.select(this).attr("fill") === currentColor;
                    })
                    .style("stroke", "black")
                    .style("stroke-width", "2px");
            })
            .on("mousemove", function (event, d) {
                // Move tooltip near the cursor
                tooltip
                  .style("left", (event.pageX + 10) + "px") 
                  .style("top", (event.pageY + 10) + "px");
              })
            .on("mouseout", function () {
                // Hide the tooltip
                tooltip.style("opacity", 0);
                // Remove highlight
                clippedArea.selectAll("." + className)
                    .style("stroke", null)
                    .style("stroke-width", null);
            });
    }

    const circles = clippedArea.selectAll("circle")
        .data(filteredData)
        .enter()
        .append("circle")
        .attr("class", "scatter-point")
        .attr("cx", d => xScale(d.labourR))
        .attr("cy", d => yScale(d.unemployR))
        .attr("r", 5)
        .attr("fill", d => selectedColorMap[d[selectedAttribute]]) // Use the selected color map
        .attr("opacity", 0.7);
    
    addHoverEffects(circles, "scatter-point");

	// Step 8: title label and legend
	titlelabel(svgContainer, margin, width, height);
	legend1(svgContainer, selectedKey, selectedColorMap, width, margin);

    // Step 9: Define zoom behavior
    const zoomBehavior = d3.zoom()
        .scaleExtent([1, 10]) // Zoom scale for both axes
        .translateExtent([[0, 0], [width, height]]) // Limit panning within original bounds
        .extent([[0, 0], [width, height]]) // Defines the area in which zooming is possible
        .on("zoom", function (event) {
            const zoomTransform = event.transform;

            // Rescale x and y axes using the zoom transformation
            const newXScale = zoomTransform.rescaleX(xScale);
            const newYScale = zoomTransform.rescaleY(yScale);

            // Update both axes
            xAxisGroup.call(xAxis.scale(newXScale));
            yAxisGroup.call(yAxis.scale(newYScale));

            // Update circles' positions based on new scales
            circles
            .attr("cx", d => newXScale(d.labourR))
            .attr("cy", d => newYScale(d.unemployR));
    });

    // Step 9: Apply zoom behavior to the SVG container
    svgContainer.call(zoomBehavior);
}

function legend1(svgContainer, selectedKey, selectedColorMap, width, margin) {
    // Remove any existing legend before drawing a new one
    svgContainer.select(".legend-container").remove();

    // Create a new legend container group
    const legendContainer = svgContainer.append("g")
        .attr("class", "legend-container")
        .attr("transform", `translate(${width}, ${margin.top})`);

    // Convert color map into an array of { label, color }
    const legendData = Object.entries(selectedColorMap).map(([label, color]) => ({ label, color }));

    // Draw legend items
    const legendItems = legendContainer.selectAll(".legend-item")
        .data(legendData)
        .enter()
        .append("g")
        .attr("class", "legend-item")
        .attr("transform", (d, i) => `translate(0, ${i * 25})`); // Space items vertically

    // Draw legend color circles
    legendItems.append("circle")
        .attr("r", 5)
        .attr("fill", d => d.color)
        .attr("cx", 0)
        .attr("cy", 0);

    // Draw legend labels
    legendItems.append("text")
        .attr("x", 15)
        .attr("y", 5)
        .text(d => d.label)
        .attr("font-size", "12px")
        .attr("alignment-baseline", "middle");
}





function scatter2(data, selectedStates, svgContainer, colors, margin, width, height) {
    console.log("scatter2 called");

    // Create a tooltip div and hide it by default
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip-scatter2")
        .style("position", "absolute")
        .style("background-color", "#fff")
        .style("border", "1px solid #ccc")
        .style("border-radius", "1px")
        .style("padding", "5px")
        .style("opacity", 0) // hidden by default
        .style("pointer-events", "none") // doesn't block mouse events
        .style("font-size", "12px");


    // Map keys to attributes
    const keyAttributeMap = {
        "Gender": "sex",
        "Birthplace": "birthplace",
        "Education": "education"
    };

    // Map keys to color schemes
    const keyColorMap = {
        "Birthplace": colors[1], // color_birp
        "Education": colors[2]   // color_edu
    };

    // Identify selected keys
    const selectedKeys = Object.keys(selectedStates).filter(key => selectedStates[key]);
    if (selectedKeys.length !== 2) {
        console.warn("scatter2 requires exactly two selected keys.");
        return;
    }

    const unselectedKey = Object.keys(selectedStates).find(key => !selectedStates[key]);
    const attr3 = keyAttributeMap[unselectedKey];

    const isGenderSelected = selectedKeys.includes("Gender");

    // Step 1: Define attributes based on selected keys
    const firstKey = selectedKeys[0];
    const secondKey = selectedKeys[1];

    const attr1 = keyAttributeMap[firstKey];
    const attr2 = keyAttributeMap[secondKey];

    // Step 2: Filter data (remove "Total" values, only keep year > 2018)
    const filteredData = data.filter(d => 
        d[attr1] !== "Total" &&
        d[attr2] !== "Total" &&
        d[attr3] === "Total" &&
        d.year > 2018
    );

    // Step 3: Define scales
    const xScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => d.unemployR) + 1])
        .range([height, 0]);

    // Step 4: Add Clipping
    svgContainer.append("defs")
        .append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height);

    // Step 5: Create plot area
    const plotArea = svgContainer.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Step 6: Add axes
    const xAxisGroup = svgContainer.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(${margin.left}, ${margin.top + height})`);
    
    const yAxisGroup = svgContainer.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    xAxisGroup.call(xAxis);
    yAxisGroup.call(yAxis);

    // Step 7: Create a clipped area for the data points
    const clippedArea = plotArea.append("g")
        .attr("clip-path", "url(#clip)");

    // Helper function to highlight glyphs of the same class & color
    function addHoverEffects(selection, className) {
        selection
            .on("mouseover", function (event, d) {
                const currentColor = d3.select(this).attr("fill");
            
            // Construct tooltip text while excluding "Total" from the displayed properties
            let tooltipText = [
                d.sex !== "Total" ? d.sex : null,
                d.birthplace !== "Total" ? d.birthplace : null,
                d.education !== "Total" ? d.education : null
            ].filter(value => value !== null).join(" - "); // Remove null values and join with "-"

            // Show tooltip only if there's relevant information
            tooltip
                .style("opacity", 1)
                .html(tooltipText); 
                // Highlight all glyphs with same class and color
                clippedArea.selectAll("." + className)
                    .filter(function () {
                        return d3.select(this).attr("fill") === currentColor;
                    })
                    .style("stroke", "black")
                    .style("stroke-width", "2px");
            })
            .on("mousemove", function (event, d) {
                // Move tooltip near the cursor
                tooltip
                  .style("left", (event.pageX + 10) + "px") 
                  .style("top", (event.pageY + 10) + "px");
              })
            .on("mouseout", function () {
                // Hide the tooltip
                tooltip.style("opacity", 0);
                // Remove highlight
                clippedArea.selectAll("." + className)
                    .style("stroke", null)
                    .style("stroke-width", null);
            });
    }

    // Step 8: Draw points based on selection logic
    if (isGenderSelected) {
        // Gender is selected, use shape for gender and color for other key
        const otherKey = selectedKeys.find(key => key !== "Gender");
        const otherAttribute = keyAttributeMap[otherKey];
        const otherColorMap = keyColorMap[otherKey];

        // Draw circles for females
        const circles = clippedArea.selectAll(".circle-female")
            .data(filteredData.filter(d => d.sex === "Female"))
            .enter()
            .append("circle")
            .attr("class", "circle-female")
            .attr("cx", d => xScale(d.labourR))
            .attr("cy", d => yScale(d.unemployR))
            .attr("r", 5)
            .attr("fill", d => otherColorMap[d[otherAttribute]])
            .attr("opacity", 0.7);

        // Add hover effects for circles
        addHoverEffects(circles, "circle-female");

        // Draw triangles for males
        const triangles = clippedArea.selectAll(".triangle-male")
            .data(filteredData.filter(d => d.sex === "Male"))
            .enter()
            .append("path")
            .attr("class", "triangle-male")
            .attr("d", d3.symbol().type(d3.symbolTriangle).size(60))
            .attr("transform", d => `translate(${xScale(d.labourR)}, ${yScale(d.unemployR)})`)
            .attr("fill", d => otherColorMap[d[otherAttribute]])
            .attr("opacity", 0.7);

        // Add hover effects for triangles
        addHoverEffects(triangles, "triangle-male");

    } else {
        // Gender is NOT selected, use cross and diamond for birthplace
        const colorEdu = keyColorMap["Education"];

        // Draw crosses for Natives
        const crosses = clippedArea.selectAll(".cross-native")
            .data(filteredData.filter(d => d.birthplace === "Native"))
            .enter()
            .append("path")
            .attr("class", "cross-native")
            .attr("d", d3.symbol().type(d3.symbolCross).size(60))
            .attr("transform", d => `translate(${xScale(d.labourR)}, ${yScale(d.unemployR)})`)
            .attr("fill", d => colorEdu[d.education])
            .attr("opacity", 0.7);

        addHoverEffects(crosses, "cross-native");

        // Draw diamonds for Foreigners
        const diamonds = clippedArea.selectAll(".diamond-foreign")
            .data(filteredData.filter(d => d.birthplace === "Foreign"))
            .enter()
            .append("path")
            .attr("class", "diamond-foreign")
            .attr("d", d3.symbol().type(d3.symbolDiamond).size(60))
            .attr("transform", d => `translate(${xScale(d.labourR)}, ${yScale(d.unemployR)})`)
            .attr("fill", d => colorEdu[d.education])
            .attr("opacity", 0.7);

        addHoverEffects(diamonds, "diamond-foreign");
    }

    // Step 9: Add Title and Legend
    titlelabel(svgContainer, margin, width, height);
    legend2(svgContainer, colors, selectedStates, margin, width, height);

    // Step 10: Define Zoom Behavior
    const zoomBehavior = d3.zoom()
        .scaleExtent([1, 10])
        .translateExtent([[0, 0], [width, height]])
        .extent([[0, 0], [width, height]])
        .on("zoom", function (event) {
            const zoomTransform = event.transform;
            const newXScale = zoomTransform.rescaleX(xScale);
            const newYScale = zoomTransform.rescaleY(yScale);
            xAxisGroup.call(xAxis.scale(newXScale));
            yAxisGroup.call(yAxis.scale(newYScale));

            // Update circle positions
            clippedArea.selectAll("circle")
                .attr("cx", d => newXScale(d.labourR))
                .attr("cy", d => newYScale(d.unemployR));

            // Update path (triangles, crosses, diamonds)
            clippedArea.selectAll("path")
                .attr("transform", d => `translate(${newXScale(d.labourR)}, ${newYScale(d.unemployR)})`);
        });

    // Step 11: Apply Zoom Behavior to the SVG container
    svgContainer.call(zoomBehavior);
}

function legend2(svgContainer, colors, selectedStates, margin, width, height) {
    // Define legend position
    const legendX = width;
    const legendY = margin.top;

    // Clear existing legend before drawing a new one
    svgContainer.selectAll(".legend-container").remove();

    // Create legend group
    const legend = svgContainer.append("g")
        .attr("class", "legend-container")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    // Identify selected and unselected attributes
    const selectedKeys = Object.keys(selectedStates).filter(key => selectedStates[key]);
    const isGenderSelected = selectedKeys.includes("Gender");

    if (isGenderSelected) {
        // Gender is selected, use grey shapes for gender and colored circles for other attribute
        const otherKey = selectedKeys.find(key => key !== "Gender");
        const otherColorMap = colors[otherKey === "Birthplace" ? 1 : 2];

        // Gender Symbols
        legend.append("circle")
            .attr("cx", 10).attr("cy", 10).attr("r", 6)
            .attr("fill", "grey").attr("opacity", 0.7);
        legend.append("text")
            .attr("x", 25).attr("y", 15)
            .text("Female").attr("font-size", "12px");

        legend.append("path")
            .attr("d", d3.symbol().type(d3.symbolTriangle).size(80))
            .attr("transform", "translate(10,30)")
            .attr("fill", "grey").attr("opacity", 0.7);
        legend.append("text")
            .attr("x", 25).attr("y", 35)
            .text("Male").attr("font-size", "12px");

        // Other attribute color representation
        Object.keys(otherColorMap).forEach((key, i) => {
            legend.append("rect")
                .attr("x", 5).attr("y", 45 + i * 20)
                .attr("width", 12).attr("height", 12)
                .attr("fill", otherColorMap[key]);
            legend.append("text")
                .attr("x", 25).attr("y", 55 + i * 20)
                .text(key).attr("font-size", "12px");
        });

    } else {
        // Gender is NOT selected, use grey cross and diamond for birthplace, colored circles for education
        const colorEdu = colors[2];

        // Birthplace Symbols
        legend.append("path")
            .attr("d", d3.symbol().type(d3.symbolCross).size(80))
            .attr("transform", "translate(10,10)")
            .attr("fill", "grey").attr("opacity", 0.7);
        legend.append("text")
            .attr("x", 25).attr("y", 15)
            .text("Native").attr("font-size", "12px");

        legend.append("path")
            .attr("d", d3.symbol().type(d3.symbolDiamond).size(80))
            .attr("transform", "translate(10,30)")
            .attr("fill", "grey").attr("opacity", 0.7);
        legend.append("text")
            .attr("x", 25).attr("y", 35)
            .text("Foreign").attr("font-size", "12px");

        // Education Colors
        Object.keys(colorEdu).forEach((key, i) => {
            legend.append("rect")
                .attr("x", 5).attr("y", 45 + i * 20)
                .attr("width", 12).attr("height", 12)
                .attr("fill", colorEdu[key]);
            legend.append("text")
                .attr("x", 25).attr("y", 55 + i * 20)
                .text(key).attr("font-size", "12px");
        });
    }
}






function scatter3(data, selectedStates, svgContainer, colors, margin, width, height) {
    console.log("scatter3 called");

    // Create the Tooltip DIV
    const tooltip = d3.select("body")
      .append("div")
      .attr("class", "tooltip-scatter3")
      .style("position", "absolute")
      .style("background-color", "#fff")
      .style("border", "1px solid #ccc")
      .style("border-radius", "4px")
      .style("padding", "5px")
      .style("opacity", 0)  // start hidden
      .style("pointer-events", "none")
      .style("font-size", "12px");

    // Step 1: Filter data (Remove "Total" entries in sex, birthplace, and education)
    const filteredData = data.filter(d => 
        d.sex !== "Total" &&
        d.birthplace !== "Total" &&
        d.education !== "Total" &&
        d.year >= 2020
    );

    // Step 2: Define Scales
    const xScale = d3.scaleLinear()
        .domain([0, 100])
        .range([0, width]);

    const yScale = d3.scaleLinear()
        .domain([0, d3.max(filteredData, d => d.unemployR) + 1])
        .range([height, 0]);

    // Color scale for Birthplace using colors[1]
    const birthplaceColors = colors[1];
    const colorScale = d3.scaleOrdinal()
        .domain(["Native", "Foreign"])
        .range([birthplaceColors["Native"], birthplaceColors["Foreign"]]);

    // Opacity scale for Education
    const opacityScale = d3.scaleOrdinal()
        .domain(["Less than basic", "Basic", "Intermediate", "Advanced"])
        .range([0.1, 0.4, 0.7, 1.0]);

    // Step 3: Add Clipping Path
    svgContainer.append("defs")
        .append("clipPath")
        .attr("id", "clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);

    // Step 4: Create Plot Area
    const plotArea = svgContainer.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Step 5: Add Axes
    const xAxisGroup = svgContainer.append("g")
        .attr("class", "x-axis")
        .attr("transform", `translate(${margin.left}, ${margin.top + height})`);
    
    const yAxisGroup = svgContainer.append("g")
        .attr("class", "y-axis")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3.axisLeft(yScale);

    xAxisGroup.call(xAxis);
    yAxisGroup.call(yAxis);

    // Step 6: Create a clipped area for the data points
    const clippedArea = plotArea.append("g")
        .attr("clip-path", "url(#clip)");

    // Step 7: Draw Glyphs (Circles & Triangles)

    // Circles for Females
    const femaleCircles = clippedArea.selectAll(".circle-female")
        .data(filteredData.filter(d => d.sex === "Female"))
        .enter()
        .append("circle")
        .attr("class", "circle-female")
        .attr("cx", d => xScale(d.labourR))
        .attr("cy", d => yScale(d.unemployR))
        .attr("r", 5)
        .attr("fill", d => colorScale(d.birthplace)) // Color based on Birthplace
        .attr("fill-opacity", d => opacityScale(d.education));

    // Add hover/tooltip
    addHoverEffects(femaleCircles, "circle-female", clippedArea);

    // Triangles for Males
    const maleTriangles = clippedArea.selectAll(".triangle-male")
        .data(filteredData.filter(d => d.sex === "Male"))
        .enter()
        .append("path")
        .attr("class", "triangle-male")
        .attr("d", d3.symbol().type(d3.symbolTriangle).size(60))
        .attr("transform", d => `translate(${xScale(d.labourR)}, ${yScale(d.unemployR)})`)
        .attr("fill", d => colorScale(d.birthplace)) // Color based on Birthplace
        .attr("fill-opacity", d => opacityScale(d.education));

    // Add hover/tooltip
    addHoverEffects(maleTriangles, "triangle-male", clippedArea);

    // Step 8: Add title label and legend
    titlelabel(svgContainer, margin, width, height);
    legend3(svgContainer, colors, margin, width, height);

    // Step 9: Add Zoom Functionality
    const zoomBehavior = d3.zoom()
        .scaleExtent([1, 10])
        .translateExtent([[0, 0], [width, height]])
        .extent([[0, 0], [width, height]])
        .on("zoom", function (event) {
            const zoomTransform = event.transform;
            const newXScale = zoomTransform.rescaleX(xScale);
            const newYScale = zoomTransform.rescaleY(yScale);
            xAxisGroup.call(xAxis.scale(newXScale));
            yAxisGroup.call(yAxis.scale(newYScale));

            // Update positions of elements
            clippedArea.selectAll("circle")
                .attr("cx", d => newXScale(d.labourR))
                .attr("cy", d => newYScale(d.unemployR));

            clippedArea.selectAll("path")
                .attr("transform", d => `translate(${newXScale(d.labourR)}, ${newYScale(d.unemployR)})`);
        });

    svgContainer.call(zoomBehavior);

    // addHoverEffects function
    function addHoverEffects(selection, className, clippedArea) {
      selection
        .on("mouseover", function (event, d) {
          // Show tooltip
          tooltip
            .style("opacity", 1)
            .html(`${d.sex} - ${d.birthplace} - ${d.education}`);

          // Get color & opacity
          const currentColor = d3.select(this).attr("fill");
          const currentOpacity = d3.select(this).attr("fill-opacity");

          // Highlight all glyphs of same class, color, and opacity
          clippedArea.selectAll("." + className)
            .filter(function() {
              const s = d3.select(this);
              return (
                s.attr("fill") === currentColor &&
                s.attr("fill-opacity") === currentOpacity
              );
            })
            .style("stroke", "black")
            .style("stroke-width", "2px");
        })
        .on("mousemove", function (event) {
          // Move tooltip near cursor
          tooltip
            .style("left", (event.pageX + 10) + "px")
            .style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function () {
          // Hide tooltip
          tooltip.style("opacity", 0);

          // Remove highlight from this class
          clippedArea.selectAll("." + className)
            .style("stroke", null)
            .style("stroke-width", null);
        });
    }
}

function legend3(svgContainer, colors, margin, width, height) {
    console.log("legend3 called");

    // Define legend position
    const legendX = width;
    const legendY = margin.top;

    // Clear existing legend before drawing a new one
    svgContainer.selectAll(".legend-container").remove();

    // Create legend group
    const legend = svgContainer.append("g")
        .attr("class", "legend-container")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    // Define Birthplace Colors from colors[1]
    const birthplaceColors = colors[1];

    // Define Education Opacity Levels
    const educationLevels = ["Advanced", "Intermediate", "Basic", "Less than basic"];
    const opacityScale = d3.scaleOrdinal()
        .domain(educationLevels)
        .range([1.0, 0.7, 0.4, 0.1]);

    // Sex Representation (Grey Triangle & Circle)
    legend.append("circle")
        .attr("cx", 10).attr("cy", 10).attr("r", 6)
        .attr("fill", "grey").attr("opacity", 0.7);
    legend.append("text")
        .attr("x", 25).attr("y", 15)
        .text("Female").attr("font-size", "12px");

    legend.append("path")
        .attr("d", d3.symbol().type(d3.symbolTriangle).size(80))
        .attr("transform", "translate(10,30)")
        .attr("fill", "grey").attr("opacity", 0.7);
    legend.append("text")
        .attr("x", 25).attr("y", 35)
        .text("Male").attr("font-size", "12px");

    // Birthplace Representation (Colored Rectangles)
    Object.keys(birthplaceColors).forEach((key, i) => {
        legend.append("rect")
            .attr("x", 5).attr("y", 50 + i * 20)
            .attr("width", 12).attr("height", 12)
            .attr("fill", birthplaceColors[key]); // Color from colors[1]
        legend.append("text")
            .attr("x", 25).attr("y", 60 + i * 20)
            .text(key).attr("font-size", "12px");
    });

    // Education Representation (Red Rectangles with Opacity)
    educationLevels.forEach((level, i) => {
        legend.append("rect")
            .attr("x", 5).attr("y", 100 + i * 20)
            .attr("width", 12).attr("height", 12)
            .attr("fill", birthplaceColors["Native"])
            .attr("opacity", opacityScale(level));
        legend.append("text")
            .attr("x", 25).attr("y", 110 + i * 20)
            .text(level).attr("font-size", "12px");
    });
}
