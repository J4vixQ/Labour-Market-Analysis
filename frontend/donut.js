function drawDonuts(DATA0) {
    console.log("drawDonuts");

    // Filter data
    const validSex = ["Male", "Female"];
    const validBirthplace = ["Native", "Foreign"];
    const validEducation = ["Advanced", "Intermediate", "Basic", "Less than basic"];

    const data = DATA0.filter(d =>
        d.year === 2023 &&
        validSex.includes(d.sex) &&
        validBirthplace.includes(d.birthplace) &&
        validEducation.includes(d.education) &&
        d.workpopK !== null // Ensure workpopK is not null
    );

    // Initial color definitions
    let color_inn = { "Male": "rgb(96, 197, 222)", "Female": "rgb(240, 115, 169)" };
    let color_mid = { "Native": "rgb(228, 80, 80)", "Foreign": "rgb(76, 139, 222)" };
    let color_out = { 
		"Advanced": "#190069", 
		"Intermediate": "#6626a6", 
		"Basic": "#a56ec4", 
		"Less than basic": "#e6ccf0" 
    };

    // Dimensions and margins
    const margin = { top: 20, right: 400, bottom: 20, left: 100 };
    const width = 1000;
    const height = 600;

    // Adjust chart radius based on margins
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    // Radius levels and widths
    const lv_inn = Math.min(chartWidth, chartHeight) / 2 - 120;
    const lv_mid = lv_inn + 60;
    const lv_out = lv_mid + 40;

    const r_inn = 80;  // Width of the inner donut
    const r_mid = 60;  // Width of the middle donut
    const r_out = 40;  // Width of the outer donut

    // Initial categories
    let cat_inn = "sex";
    let cat_mid = "birthplace";
    let cat_out = "education";

    const aggregateData = () => {
        // step1: draw inner donut with cat_inn
        // for example, male and female
        const innerData = d3.rollups(
            data,
            v => d3.sum(v, d => d.workpopK),
            d => d[cat_inn]
        ).map(([key, value]) => ({ key, value }));

        // step2: draw middle donut with cat_inn and cat_mid, 
        // for example, male native, male foreign, female native, female foreign
        const middleData = d3.rollups(
            data,
            v => d3.sum(v, d => d.workpopK),
            d => d[cat_inn],
            d => d[cat_mid]
        ).flatMap(([key, group]) =>
            group.map(([subkey, value]) => ({ key: `${key}-${subkey}`, value }))
        );

        // step3: draw outer donut with cat_inn and cat_mid and cat_out, 
        // for example, male native advanced, male native basic, male foreign advanced, male foreign basic, female native advanced... 
        const outerData = d3.rollups(
            data,
            v => d3.sum(v, d => d.workpopK),
            d => d[cat_inn],
            d => d[cat_mid],
            d => d[cat_out]
        ).flatMap(([key, group]) =>
            group.flatMap(([subkey, subgroup]) =>
                subgroup.map(([subsubkey, value]) => ({
                    key: `${key}-${subkey}-${subsubkey}`,
                    value
                }))
            )
        );

        return { innerData, middleData, outerData };
    };

    // Donut generator functions
    const arcGenerator = (innerRadius, outerRadius) => d3.arc()
        .innerRadius(innerRadius)
        .outerRadius(outerRadius);

    const pieGenerator = d3.pie()
        .sort(null)
        .value(d => d.value);

    const drawAndTransition = (svg, shadowData, trueData, color, innerRadius, outerRadius, onClick, allPaths) => {
        const arc = arcGenerator(innerRadius, outerRadius);
    
        // Compute initial and updated pie layouts
        const initializedPie = pieGenerator(shadowData); // Shadow data for initialization
        const updatedPie = pieGenerator(trueData); // True data for smooth transition
    
        // Draw paths for the shadow data
        const group = svg.append("g");
        const path = group.selectAll("path")
            .data(initializedPie)
            .join("path")
            .attr("fill", d => color[d.data.key.split('-').pop()])
            .attr("d", arc)
            .each(function (d) { this._current = d; }) // Store initial state
            .on("mouseenter", (event, d) => {
                // Extract ancestors
                const parts = d.data.key.split('-');
                const ancestors = parts.map((_, i) => parts.slice(0, i + 1).join('-'));
                // Highlight ancestors across all layers
                allPaths.forEach(p => {
                    const pathData = d3.select(p).datum();
                    d3.select(p).attr("fill-opacity", ancestors.includes(pathData.data.key) ? 1.0 : 0.2);
                });
            })
            .on("mouseleave", () => {
                // Reset opacity for all layers
                allPaths.forEach(p => d3.select(p).attr("fill-opacity", 1.0));
            })
            .on("click", onClick);
    
        // Add paths to `allPaths`
        path.each(function () {
            allPaths.push(this);
        });
    
        // Update tooltips for the initial render
        path.append("title")
            .text(d => {
                const value = d.data.value;
                if (value <= 1000) {
                    return `${d.data.key}: ${(value).toFixed(2)} thousand`;
                } else {
                    return `${d.data.key}: ${(value / 1000).toFixed(2)} million`;
                }
            });
    
        // Smooth transition to the true data
        path.data(updatedPie) // Rebind the true data to the paths
            .transition()
            .duration(750)
            .attrTween("d", function (a) {
                const i = d3.interpolate(this._current, a); // Interpolate between current and new angles
                this._current = i(1); // Update the current state for future transitions
                return (t) => arc(i(t)); // Return the interpolated arc
            });
    
        // Update tooltips after transition
        path.select("title")
            .text(d => {
                const value = d.data.value;
                if (value <= 1000) {
                    return `${d.data.key}: ${(value).toFixed(2)} thousand`;
                } else {
                    return `${d.data.key}: ${(value / 1000).toFixed(2)} million`;
                }
            });
    };

    // render donuts (including legends)
    const render = () => {
        const { innerData, middleData, outerData } = aggregateData();
    
        const innerShadow = innerData.map(d => ({ key: d.key, value: 100 }));
        const middleShadow = middleData.map(d => ({ key: d.key, value: 100 }));
        const outerShadow = outerData.map(d => ({ key: d.key, value: 100 }));
    
        d3.select("#donut-container").select("svg").remove();
    
        const container = d3.select("#donut-container");
        const svg = container.append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .append("g")
            .attr("transform", `translate(${margin.left + chartWidth / 2}, ${margin.top + chartHeight / 2})`);
    
        // Shared array to store all paths
        const allPaths = [];
    
        // Draw and transition all layers, adding paths to `allPaths`
        drawAndTransition(svg, innerShadow, innerData, color_inn, lv_inn - r_inn, lv_inn, () => swapCategories("inner"), allPaths);
        drawAndTransition(svg, middleShadow, middleData, color_mid, lv_mid - r_mid, lv_mid, () => swapCategories("middle"), allPaths);
        drawAndTransition(svg, outerShadow, outerData, color_out, lv_out - r_out, lv_out, () => swapCategories("outer"), allPaths);
    
        // title
        svg.append("text")
        .attr("class", "title")
        .attr("x", 0)
        .attr("y", margin.top - height/2 + 10)
        .attr("text-anchor", "middle")
        .attr("font-size", "24px")
        .attr("fill", "black")
        .text("Working Age Population in Europe");

        // legend
        donutLegend(svg, color_out, color_mid, color_inn, lv_out);
    };
    
    // Swap categories and colors on click
    const swapCategories = (clickedLayer) => {
        let tempCat, tempColor;

        if (clickedLayer === "inner") {  // swap inn and mid
            tempCat = cat_inn;
            cat_inn = cat_mid;
            cat_mid = tempCat;
            tempColor = color_inn;
            color_inn = color_mid;
            color_mid = tempColor;
        } else if (clickedLayer === "middle") {  // disabled
            // tempCat = cat_inn;
            // cat_inn = cat_mid;
            // cat_mid = tempCat;
            // tempColor = color_inn;
            // color_inn = color_mid;
            // color_mid = tempColor;
        } else if (clickedLayer === "outer") {  // swap out and mid
            tempCat = cat_out;
            cat_out = cat_mid;
            cat_mid = tempCat;
            tempColor = color_out;
            color_out = color_mid;
            color_mid = tempColor;
        }

        // Re-render chart with updated categories and colors, and re-draw legend
        render();
    };

    // Initial render and inital legend
    render();
}

const donutLegend = (svg, colorOut, colorMid, colorInn, lv_out) => {
    const legendGroup = svg.append("g")
        .attr("class", "legend-group")
        .attr("transform", `translate(${lv_out + 50}, ${-lv_out + 20})`); // Position legend to the right of the donut chart

    const determineCategory = (colorMap) => {
        const firstKey = Object.keys(colorMap)[0];
        if (["Male", "Female"].includes(firstKey)) return "Gender";
        if (["Native", "Foreign"].includes(firstKey)) return "Birthplace";
        if (["Advanced", "Intermediate", "Basic", "Less than basic"].includes(firstKey)) return "Education";
        return "Unknown";
    };

    const addLegendSection = (group, colorMap, xOffset) => {
        const category = determineCategory(colorMap);
        const section = group.append("g")
            .attr("transform", `translate(${xOffset}, 0)`);

        section.append("text")
            .attr("x", 0)
            .attr("y", 0)
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text(category);

        const items = section.selectAll("g")
            .data(Object.entries(colorMap))
            .join("g")
            .attr("transform", (d, i) => `translate(0, ${20 + i * 20})`);

        items.append("rect")
            .attr("x", 0)
            .attr("y", -10)
            .attr("width", 16)
            .attr("height", 16)
            .attr("fill", ([, color]) => color);

        items.append("text")
            .attr("x", 24)
            .attr("y", 0)
            .attr("dy", "0.35em")
            .attr("font-size", "12px")
            .text(([key]) => key);
    };

    // Add each legend section dynamically
    const sectionWidth = 120;
    addLegendSection(legendGroup, colorInn, 0);
    addLegendSection(legendGroup, colorMid, sectionWidth);
    addLegendSection(legendGroup, colorOut, sectionWidth * 2);
};


