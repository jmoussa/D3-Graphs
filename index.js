// TODO: Sort out sexes (Male || Female)
function loadFile() {
    var input, file, fr;
    var input, file, fr;
    if (typeof window.FileReader !== 'function') {
      alert("The file API isn't supported on this browser yet.");
      return;
    }
    input = document.getElementById('fileinput');
    if (!input) {
      alert("Um, couldn't find the fileinput element.");
    }
    else if (!input.files) {
      alert("This browser doesn't seem to support the `files` property of file inputs.");
    }
    else if (!input.files[0]) {
      alert("Please select a file before clicking 'Load'");
    }
    else {
      file = input.files[0];
      fr = new FileReader();
      fr.onload = receivedText;
      fr.readAsText(file);
    }
    function receivedText(e) {
        let lines = e.target.result;
        let parsed_json = JSON.parse(lines);
        let arr = cleanAndSortArray(parsed_json.stats_array)
        let raw_arr = parsed_json.stats_array
        drawAbsoluteRiskCurve(arr, 9, 'Female') // TODO: 45 can be replaced by patient percentile value 
        plotDensity(raw_arr, 0.269, 'Female') // TODO: 0.053 can be replaced by patient absolute risk value
        //drawROCCurve(raw_arr, parsed_json.disease, 'Male') 
    }
}

/*
 *  Cleans up and minimizes data from 50000 points to 100 for percentile calculations
*/
function cleanAndSortArray(data){
    var clean_arr = []
    var percentile_arr = []
    for(var i=0; i<data.length; i++){
        //console.log(data[i].percentile)
        if(!percentile_arr.includes(data[i].percentile)){
            clean_arr.push(data[i]) 
            percentile_arr.push(data[i].percentile) 
        }
    }
    clean_arr.sort(function(a,b) {
        return a.percentile - b.percentile
    });
    //console.log('CLEAN ARRAY LENGTH: ' + clean_arr.length)
    return clean_arr;
}

function sortObjArrayByX(data){
    data.sort(function(a,b){
        return parseFloat(a.x) - parseFloat(b.x)
    });
    return data;
}
/*
 * Plots the Distribution of cases and controls
 * Bins all of the c/c and creates a histogram, 
 * which is then connected by lines
 * 
 * Also calculates avg absolute risk of cases and controls / the population*
*/

function plotDensity(data, patient_risk, sex) {    
    data = data.filter(c => c.sex == sex) 
    let case_objects_list = data.filter(c => c.x == 1)
    let control_objects_list = data.filter(c => c.x == 0)
    console.log('Cases ' + case_objects_list.length)
    console.log('Controls ' + control_objects_list.length)
    if(case_objects_list.length > 30){
        let avg_risk = d3.mean(data.map(function(d){return d.y;})) 

        var svgWidth = 600, svgHeight = 400;
        var margin = {top: 50, right:50, bottom:80, left: 80};
        var width = svgWidth -  margin.left - margin.right;
        var height = svgHeight - margin.top - margin.bottom;
        var svg = d3.select(".density")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
        var g = svg.append('g')
            .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
            
        // x axis 
        var x = d3.scaleLinear()
            .domain([-0, d3.extent(data.map(function(d){return d.y;}))[1]])//d3.extent(data.map(function(d){return d.y;})))
            .rangeRound([0, width])
        
        var threshold = x.ticks(20);
        var case_len = case_objects_list.length
        switch(case_len){
            case case_len < 200:
                console.log('Less than 200');
                threshold=x.ticks(10);
                break;
            case case_len < 500:
                console.log('Less than 500');
                threshold=x.ticks(15);
                break;
            case case_len > 501:
                console.log('Greater than 500');
                threshold=x.ticks(20);
                break;
            default:
                console.log('Default');
                threshold=x.ticks(15);
                break;
        }
        var bin = d3.histogram()
            .value(function(d){return d.y;})
            .domain(x.domain())
            .thresholds(threshold)
        
        var case_bins = bin(case_objects_list)//.filter(bin => bin.x0 >= -0 && bin.x1 >= -0)
        var control_bins = bin(control_objects_list)//.filter(bin=> bin.x0 >= -0 && bin.x1 >= -0)
        
        var case_max = d3.max(case_bins, function(d){ return d.length }) / case_objects_list.length
        var control_max = d3.max(control_bins, function(d){ return d.length }) / control_objects_list.length
        var tru_max = case_max > control_max ? case_max : control_max;
        
        var case_min = d3.min(case_bins, function(d){ return d.length }) / case_objects_list.length
        var control_min = d3.min(control_bins, function(d){ return d.length }) / control_objects_list.length
        var tru_min = case_min < control_min ? case_min : control_min;
        
        // y axis 
        var y = d3.scaleLinear()
            .domain([0, tru_max*1.5 < 1 ? tru_max*1.5 : 1])
            .rangeRound([height, 0]);
        
        // LINE
        var line_case = d3.line()
            .curve(d3.curveMonotoneX)
            .x(function(d){ return (x(d.x0) ); })
            .y(function(d){ return y(d.length/case_objects_list.length)});

        var line_control= d3.line()
            .curve(d3.curveMonotoneX)
            .x(function(d){ return (x(d.x0) ); })
            .y(function(d){ return y(d.length/control_objects_list.length)});

        //AREA
        var area_case = d3.area()
            .curve(d3.curveMonotoneX)
            .x(function(d){return x(d.x0);})
            .y0(y(0))
            .y1(function(d){return y(d.length/case_objects_list.length);})

        var area_control = d3.area()
            .curve(d3.curveMonotoneX)
            .x(function(d){return x(d.x0);})
            .y0(y(0))
            .y1(function(d){return y(d.length/control_objects_list.length);})
        
        // Set Axis'
        g.append('g')
            .attr('class', 'axis axis-x')
            .attr('transform', 'translate(0,' + height + ')')
            .call(d3.axisBottom(x).tickPadding(8).ticks(5));

        /*
        g.append('g')
            .attr('class', 'axis axis-y')
            .call(d3.axisLeft(y).tickPadding(8).ticks(5).tickFormat(d3.format(".0%")))
        */

        // y gridlines 
        g.append('g')
            .attr("class", "grid")
            .call(d3.axisLeft(y)
                .ticks(5)
                .tickPadding(8)
                .tickSize(-width)
                .tickFormat(d3.format(".0%")))
            .call(g => g.select(".domain").remove());

        /* 
        // Plot Bars
        g.selectAll('.rect_control')
            .data(case_bins)
                .enter()
                .append('rect')
                .attr('class', '.rect_control')
                .attr('fill', 'red')
                .attr('opacity', '.3')
                .attr('x',  function(d){ return x(d.x0) + 1})
                .attr('y', function(d) { return  y(d.length/case_objects_list.length)})
                .attr('width', function(d){ return Math.abs(x(d.x1) - x(d.x0) -1)})
                .attr('height', function(d){ return y(0) - y(d.length/case_objects_list.length)});

        g.selectAll('.rect_case')
            .data(control_bins)
                .enter()
                .append('rect')
                .attr('class', '.rect_case')
                .attr('fill', 'blue')
                .attr('opacity', '.2')
                .attr('x',  function(d){ return x(d.x0) + 1})
                .attr('y', function(d) { return  y(d.length/control_objects_list.length)})
                .attr('width', function(d){ return Math.abs(x(d.x1) - x(d.x0) -1)})
                .attr('height', function(d){ return y(0) - y(d.length/control_objects_list.length)});
        */ 

        // DEFINE Gradients
        var defs = svg.append("defs");
        var case_gradient = defs.append("linearGradient")
            .attr("id", "caseGradient")
            .attr("x1", "100%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "100%");
        case_gradient.append("stop")
            .attr('class', 'start')
            .attr("offset", "0%")
            .attr("stop-color", "rgb(235,160, 50)")
            .attr("stop-opacity", 1);
        case_gradient.append("stop")
            .attr('class', 'end')
            .attr("offset", "100%")
            .attr("stop-color", "rgb(235,160, 50)")
            .attr("stop-opacity", 0.2);


        var control_gradient = defs.append("linearGradient")
            .attr("id", "controlGradient")
            .attr("x1", "100%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "100%");
        control_gradient.append("stop")
            .attr('class', 'start')
            .attr("offset", "0%")
            .attr("stop-color", "rgb(31,166, 189)")
            .attr("stop-opacity", 1);
        control_gradient.append("stop")
            .attr('class', 'end')
            .attr("offset", "100%")
            .attr("stop-color", "rgb(31, 166, 189)")
            .attr("stop-opacity", 0.2);

        // Plot the line CONTROL
        g.append("path")
            .attr("class", "mypath")
            .datum(control_bins)
            .attr('fill', 'none')
            .attr("opacity", ".8")
            .attr("stroke", "rgb(55,150,128)")
            .attr("stroke-width", 2)
            .attr("stroke-linejoin", "round")
            .attr("d", line_control); 
        //Plot the area
        g.append("path")
            .datum(control_bins)
            .attr('fill', 'url(#controlGradient)')
            .attr("opacity", "1")
            .attr("d", area_control); 

        // Plot the line CASE
        g.append("path")
            .attr("class", "mypath")
            .datum(case_bins)
            .attr('fill', 'none')
            .attr("opacity", ".8")
            .attr("stroke", "rgb(55,150,128)")
            .attr("stroke-width", 2)
            .attr("stroke-linejoin", "round")
            .attr("d", line_case); 
        //Plot the area
        g.append("path")
            .datum(case_bins)
            .attr('fill', 'url(#caseGradient)')
            .attr("opacity", "1")
            .attr("d", area_case); 
        
        //LEGEND
        svg.append("circle")
            .attr("cx",width-30)
            .attr("cy",margin.top-25)
            .attr("r", 5)
            .attr("fill", "rgb(235,160, 50)");
        
        svg.append("circle")
            .attr("cx",margin.left+width-40)
            .attr("cy",margin.top-25)
            .attr("r", 5)
            .style("fill", "rgb(31,166, 189)")

        svg.append("text")
            .attr("x", width-20)
            .attr("y", margin.top-25)
            .text(/*case_objects_list.length +*/ " Cases")
            .style("font-size", "14px").attr("alignment-baseline","middle")
        svg.append("text")
            .attr("x", margin.left+width-30)
            .attr("y", margin.top-25)
            .text(/*control_objects_list.length + */" Controls")
            .style("font-size", "14px")
            .attr("alignment-baseline","middle")
        // END LEGEND

        // x axis label
        svg.append("text")
            .attr("y", height + margin.top + (margin.bottom*0.5))
            .attr("x", width/2)
            .attr("dy", "1em")
            .style("text-anchor", "beginning")
            .text("Absolute Risk"); 
         
        // y axis label 
        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 0)
            .attr("x", 0 - (height / 2))
            .attr("dy", "1.5em")
            .style("text-anchor", "end")
            .text("Frequency"); 


        var bisectAbsRisk= d3.bisector(function(d) {
            return x(d.x1); 
        }).left;
        
        var avg_control_item = bisectAbsRisk(control_bins, x(avg_risk));
        var avg_control_item_x =  control_bins[avg_control_item].x0
        var avg_control_item_y = control_bins[avg_control_item].length/control_objects_list.length;
        var avg_case_item = bisectAbsRisk(case_bins, x(avg_risk));
        var avg_case_item_y = case_bins[avg_case_item].length/case_objects_list.length;
        var avg_case_item_x =  case_bins[avg_case_item].x0
        
        
        if(x(patient_risk) && x(patient_risk)  < x(d3.extent(data.map(function(d){return d.y;}))[1])){
            var patient_control_item = bisectAbsRisk(control_bins, x(patient_risk));
            var patient_control_item_x =  control_bins[patient_control_item].x0
            var patient_control_item_y = control_bins[patient_control_item].length/control_objects_list.length;
            var patient_case_item = bisectAbsRisk(case_bins, x(patient_risk));
            var patient_case_item_y = case_bins[patient_case_item].length/case_objects_list.length;
            var patient_case_item_x =  case_bins[patient_case_item].x0
        }else{
            //ABNORMALLY HIGH RISK
            var patient_control_item = bisectAbsRisk(control_bins, x(d3.extent(data.map(function(d){return d.y;}))[1]));
            var patient_control_item_x =  control_bins[patient_control_item].x0
            var patient_control_item_y = control_bins[patient_control_item].length/control_objects_list.length;
            var patient_case_item = bisectAbsRisk(case_bins, x(d3.extent(data.map(function(d){return d.y;}))[1]));
            var patient_case_item_y = case_bins[patient_case_item].length/case_objects_list.length;
            var patient_case_item_x =  case_bins[patient_case_item].x0
        
        }
        // Tallest Lines
        var avg_tallest_y = avg_case_item_y > avg_control_item_y ? avg_case_item_y : avg_control_item_y;
        var patient_tallest_y = patient_case_item_y > patient_control_item_y ? patient_case_item_y : patient_control_item_y;

        g.append('line')
            .attr('x1', x(avg_control_item_x))
            .attr('x2', x(avg_control_item_x))
            .attr('y1', y(avg_tallest_y)) 
            .attr("y2", height)
            .attr('class', 'solid-line')
            .attr('stroke-dasharray', '3,3')
            .attr('stroke-width', 2)
            .attr("stroke", 'white') 
        // Avg Absolute Risk Dots
        g.append('circle')
            .attr('r', 5)
            .attr('cx', x(avg_control_item_x))
            .attr('cy', y(avg_tallest_y)) 
            .style('fill', 'rgb(55,150,128)')
            .style('stroke', 'white')
            .style('stroke-width', 1)
        // Avg Text Label
        g.append("text")
            .attr('class', 'avg_risk_class')
            .attr("x", x(avg_control_item_x))
            .attr("y", y(avg_tallest_y > 0.01 ? avg_tallest_y+0.035 : 0.04))
            .attr("text-anchor", "middle")  
            .text(avg_risk.toFixed(2))
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', 'rgb(55,150,128)')
            .style('opacity', 1)
            .style('z-index', 3);
        
        // Background box for text 
        var bounding_box;
        var paddingLeftRight = 18; // adjust the padding values depending on font and font size
        var paddingTopBottom = 5;
        g.selectAll('.avg_risk_class')
            .each(function(d, i){
                bounding_box = this.getBBox();
            });
        g.append("rect")
            .attr("rx", 4)
            .attr("ry", 4)
            .attr("x", x(avg_control_item_x) - bounding_box.width/2 -paddingLeftRight/2)
            .attr("y", y(avg_tallest_y > 0.01 ? avg_tallest_y+0.037: 0.05) - bounding_box.height + paddingTopBottom/2)
            .attr("width", bounding_box.width + paddingLeftRight)
            .attr("height", bounding_box.height + paddingTopBottom)
            .attr("fill", "white" )
            .attr("stroke", "none" )
            .attr("opacity", 0.9)
            .style('z-index', 2);
        
        // Avg Text Label
        g.append("text")
            .attr('class', 'avg_risk_class')
            .attr("x", x(avg_control_item_x))
            .attr("y", y(avg_tallest_y > 0.01 ? avg_tallest_y+0.035 : 0.04))
            .attr("text-anchor", "middle")  
            .text(avg_risk.toFixed(2))
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .style('fill', 'rgb(55,150,128)')
            .style('opacity', 1)
            .style('z-index', 3);
        
        //PATIENT LINE 
        if(x(patient_risk) && x(patient_risk) < x(d3.extent(data.map(function(d){return d.y;}))[1]) && ( x(patient_risk) < x(avg_control_item_x)-0.03 || x(patient_risk) > x(avg_control_item_x)+0.03)){
            // Patient Absolute Risk Line (CASE)
            g.append('line')
                .attr('x1', x(patient_case_item_x))
                .attr('x2', x(patient_case_item_x))
                .attr('y1', y(patient_tallest_y))  // cases
                .attr("y2", height)
                .attr('class', 'solid-line')
                .attr("stroke", 'rgb(55,170, 242)') 
                .attr('stroke-dasharray', '3,3')
                .attr('stroke-width', 2)
            // Patient Absolute Risk Dot
            g.append('circle')
                .attr('r', 5)
                .attr('cx', x(patient_case_item_x) )
                .attr('cy', y(patient_tallest_y)) 
                .style('fill', 'rgb(55,170, 242)')
                .style('stroke', 'white')
                .style('stroke-width', 2)


            // Patient Absolute Risk Line (CONTROL)
            g.append('line')
                .attr('x1', x(patient_control_item_x))
                .attr('x2', x(patient_control_item_x))
                .attr('y1', y(patient_tallest_y))  // cases
                .attr("y2", height)
                .attr('class', 'solid-line')
                .attr("stroke", 'rgb(55,170, 242)') 
                .attr('stroke-dasharray', '3,3')
                .attr('stroke-width', 2)
            // Patient Absolute Risk Dot
            g.append('circle')
                .attr('r', 5)
                .attr('cx', x(patient_control_item_x ) )
                .attr('cy', y(patient_tallest_y)) 
                .style('fill', 'rgb(55,170, 242)')
                .style('stroke', 'white')
                .style('stroke-width', 2)
 
            // Patient Text Label
            g.append("text")
                .attr('class', 'patient_risk_class')
                .attr("x", x(patient_control_item_x))
                .attr("y", y(patient_tallest_y > 0.01 ? patient_tallest_y+0.035 : 0.04))
                .attr("text-anchor", "middle")  
                .text(patient_risk.toFixed(2))
                .style('font-size', '14px')
                .style('font-weight', 'bold')
                .style('fill', 'rgb(55,170, 242)')
                .style('opacity', 1)
                .style('z-index', 3);
                //.style('font-size', '14px')
                //.style('fill', 'rgb(55,170, 242)');
        
            // Background box for text 
            var p_bounding_box;
            var paddingLeftRight = 18; // adjust the padding values depending on font and font size
            var paddingTopBottom = 5;
            g.selectAll('.patient_risk_class')
                .each(function(d, i){
                    p_bounding_box = this.getBBox();
                });
            g.append("rect")
                .attr("rx", 4)
                .attr("ry", 4)
                .attr("x", x(patient_control_item_x) - p_bounding_box.width/2 -paddingLeftRight/2)
                .attr("y", y(patient_tallest_y > 0.01 ? patient_tallest_y+0.037: 0.05) - p_bounding_box.height + paddingTopBottom/2)
                .attr("width", p_bounding_box.width + paddingLeftRight)
                .attr("height", p_bounding_box.height + paddingTopBottom)
                .attr("fill", "white" )
                .attr("stroke", "none" )
                .attr("opacity", 0.9)
                .style('z-index', 2);
            
            // Patient Text Label
            g.append("text")
                .attr('class', 'patient_risk_class')
                .attr("x", x(patient_control_item_x))
                .attr("y", y(patient_tallest_y > 0.01 ? patient_tallest_y+0.035 : 0.04))
                .attr("text-anchor", "middle")  
                .text(patient_risk.toFixed(2))
                .style('font-size', '14px')
                .style('font-weight', 'bold')
                .style('fill', 'rgb(55,150,128)')
                .style('opacity', 1)
                .style('z-index', 3);
            
        }    
    }    
}

function drawROCCurve(data, disease, sex){
    var case_control = []
    var scores= []

    for(var i of data){
        if (disease == 'breast'){
            if(i.sex == 'Female'){
                case_control.push(i.x)
                scores.push(i.y)
            }
        }else if(disease == 'testicular' || disease == 'prostate'){
            if(i.sex == 'Male'){
                case_control.push(i.x)
                scores.push(i.y)
            }
        }else{
            case_control.push(i.x)
            scores.push(i.y)
        }
    }
    var roc_objects = []
    var thresholds =  []
    let inc = 0
    while(inc<1.01){
        thresholds.push(inc)
        inc+=0.01
    }
    var P = case_control.reduce((a,b) => a+b, 0)
    var N = case_control.length - P
    
    for(var cutoff of thresholds){
        let FP=0
        let TP=0
        for(var i =0;i<scores.length;i++){
            if(scores[i] > cutoff){
                if(case_control[i] == 1){
                    TP+=1;
                }
                if(case_control[i] == 0){
                    FP+=1;
                }
            }
            
        }
        roc_objects.push({
            x: FP/parseFloat(N),
            y: TP/parseFloat(P)
        });
    }
    console.log('POINTS: ' + roc_objects.length)
    roc_objects = sortObjArrayByX(roc_objects)
    var svgWidth = 600, svgHeight = 600;
    var margin = {top: 80, right:80, bottom:80, left: 80};
    var width = svgWidth -  margin.left - margin.right;
    var height = svgHeight - margin.top - margin.bottom;
    
    var svg = d3.select('.roc') 
        .attr('width', svgWidth)
        .attr('height', svgHeight)

    var g = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    
    var x = d3.scaleLinear()
        .domain([0,1])
        .rangeRound([0, width])

    var y = d3.scaleLinear()
        .domain([0,1])
        .rangeRound([height, 0])

    var line = d3.line()
        .curve(d3.curveBasis)
        .x(function(d) { return x(d.x)})
        .y(function(d) { return y(d.y)})
 
    // Y axis label 
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0)
        .attr("x",0 - (height / 2))
        .attr("dy", "1.7em")
        .style("text-anchor", "end")
        .text("TPR"); 

    // X axis label
    svg.append("text")
        .attr("y", height + margin.top + (margin.bottom*0.5))
        .attr("x", width/2)
        .attr("dy", "1em")
        .style("text-anchor", "beginning")
        .text("FPR"); 
    
    // x axis
    g.append('g')
        .attr('class', 'axis axis-x')
        .attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x).tickPadding(8).ticks(5))
    
    // y axis 
    g.append('g')
        .attr("class", "grid")
        .call(d3.axisLeft(y)
            .ticks(5)
            .tickPadding(8)
            .tickSize(-width))
        .call(g => g.select(".domain").remove());
    
    // line
    g.append('path')
        .datum(roc_objects)
        .attr('fill', 'none')
        .attr('stroke', 'rgb(55,150,128)')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 2)
        .attr('d', line)
    
    var xy = [
        {x:0, y:0},
        {x:1, y:1}
    ]

    g.append('path')
        .datum(xy)
        .attr('fill', 'none')
        .attr('stroke', 'black')
        .attr('stroke-opacity', 0.3) 
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 2)
        .attr('d', d3.line()
            .curve(d3.curveBasis)
            .x(function(d) { return x(d.x)})
            .y(function(d) { return y(d.y)})
        ); 
    
    var bisectROC = d3.bisector(function(d) { return d.x; }).left
   
    // LINES WHILE HOVERING 
    var focus = g.append('g')
		.attr('class','focus')
		.style('display', 'none') 

	focus.append('line')
		.attr('class', 'x-hover-line hover-line')
		.attr('y1', 0)
		.attr('y2', height);
    
    focus.append('line')
		.attr('class', 'y-hover-line hover-line')
		.attr('x1', 0)
		.attr('x2', 0)

    focus.append('circle')
        .style('stroke', 'rgb(248,248,248)')
        .style('stroke-width', 2)
        .attr('r', 4)

     // SETUP OVERLAY TO TRACK MOUSE MOVEMENTS
    svg.append('rect')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
        .attr('class', 'overlay')
        .attr('width', width)
        .attr('height', height)
        .on('mouseover', function(){focus.style('display', null);})
        .on('mouseout', function(){focus.style('display', 'none');})
        .on('mousemove', mousemove)
    // END TOOLTIP INIT
    
    function mousemove(){
        var x0 = x.invert(d3.mouse(this)[0])
        var list = roc_objects.map(l=>l.x)
        var i = d3.bisect(list, x0) < 101 ? d3.bisect(list, x0) : 100
        var d0 = roc_objects[i - 1]
        var d1 = roc_objects[i]
        //console.log(d0) 
        //console.log(d1)
        if(d0 != undefined && d1 != undefined){
            var d = x0 - d0.x >= d1.x - x0 ? d1 : d0;
            //shift point
            focus.attr("transform", "translate(" + x(d.x) + "," + y(d.y) + ")");
            //format text
            //focus.select(".text1").html(function() { return '%ile: ' + d.percentile; });
            //focus.select(".text2").html(function() { return 'PRS: ' + d.y.toFixed(2); });
            // add x/y axis trace lines
            focus.select(".x-hover-line").attr("y2", height - y(d.y));
            focus.select(".y-hover-line").attr("x2", - (x(d.x)));
        }
    }
}



/*
     * Creates absolute risk curve with array of points supplied
     * [
     *  {
     *    percentile: percentile (int),
     *    y: PRS score (float)
     *  }
     * ]
     *
*/

function drawAbsoluteRiskCurve(data, patient_percentile, sex) {
    data = data.filter(c => c.sex == sex) 
    var svgWidth = 600, svgHeight = 400;
    var margin = {top: 50, right:50, bottom:80, left: 80};
    var width = svgWidth -  margin.left - margin.right;
    var height = svgHeight - margin.top - margin.bottom;
    var bisectPercentile = d3.bisector(function(d) { return d.percentile; }).left

    var svg = d3.select('.absolute-risk') 
        .attr('width', svgWidth)
        .attr('height', svgHeight)

    var g = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    
    var x = d3.scaleLinear()
        .rangeRound([0, width])

    var y = d3.scaleLinear()
        .rangeRound([height, 0])

    var line = d3.line()
        .curve(d3.curveBasis)
        .x(function(d) { return x(d.percentile)})
        .y(function(d) { return y(d.y)})
   
    x.domain(d3.extent(data, function(d) { return d.percentile; }))
    y.domain([0,1]) //d3.extent(data, function(d) { return d.y ; }))

    // Y axis label 
    svg.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 0)
        .attr("x",0 - (height / 2))
        .attr("dy", "1.7em")
        .style("text-anchor", "end")
        .text("Absolute Risk"); 

    // X axis label
    svg.append("text")
        .attr("y", height + margin.top + (margin.bottom*0.5))
        .attr("x", width/2)
        .attr("dy", "1em")
        .style("text-anchor", "beginning")
        .text("Percentile"); 
    
    // x axis
    g.append('g')
        .attr('class', 'axis axis-x')
        .attr('transform', 'translate(0,' + height + ')')
        .call(d3.axisBottom(x).tickPadding(8).ticks(5))
        //.select('.domain')
        //.remove()
    
    // y axis 
    g.append('g')
        .attr("class", "grid")
        .call(d3.axisLeft(y)
            .ticks(5)
            .tickPadding(8)
            .tickSize(-width)
            //.tickFormat(d3.format(".0%"))
        )
        .call(g => g.select(".domain").remove());

    // line
    g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', 'rgb(55,150,128)')
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('stroke-width', 2)
        .attr('d', line)
         
    // PATIENT PERCENTILE LINE AND POINT  
    var item = data[bisectPercentile(data, patient_percentile)];
    g.append('line')
        .attr('x1', x(patient_percentile))
        .attr('x2', x(patient_percentile))
        .attr('y1', y(item.y)) 
        .attr("y2", height)
        .attr('stroke-dasharray', '3,3') 
        .attr('stroke', 'rgb(55,170, 242)')
        .attr('stroke-width', '2') 
    
    g.append('circle')
        .attr('r', 5)
        .attr('cx', x(patient_percentile) )
        .attr('cy', y(item.y)) 
        .style('fill', 'rgb(55,170, 242)')
        .style('stroke', 'rgb(248,248,248)')
        .style('stroke-width', 2)
            
    // Avg Text Label
    g.append("text")
        .attr('class', 'patient_percentile_class')
        .attr("x", x(patient_percentile))
        .attr("y", y(item.y > 0.01 ? item.y+0.05 : 0.05))
        .attr("text-anchor", "middle")  
        .text(patient_percentile.toFixed(0))
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .style('fill', 'rgb(55,170, 242)')
        .style('opacity', 1)
        .style('z-index', 3);
    
    // Background box for text 
    var bounding_box;
    var paddingLeftRight = 18; // adjust the padding values depending on font and font size
    var paddingTopBottom = 5;
    g.selectAll('.patient_percentile_class')
        .each(function(d, i){
            bounding_box = this.getBBox();
        });
    g.append("rect")
        .attr("rx", 4)
        .attr("ry", 4)
        .attr("x", x(patient_percentile) - bounding_box.width/2 -paddingLeftRight/2)
        .attr("y", y(item.y > 0.01 ? item.y+0.057 : 0.05) - bounding_box.height + paddingTopBottom/2)
        .attr("width", bounding_box.width + paddingLeftRight)
        .attr("height", bounding_box.height + paddingTopBottom)
        .attr("fill", "white" )
        .attr("stroke", "none" )
        .attr("opacity", 0.9)
        .style('z-index', 2);
             
    // Avg Text Label
    g.append("text")
        .attr('class', 'patient_percentile_class')
        .attr("x", x(patient_percentile))
        .attr("y", y(item.y > 0.01 ? item.y+0.05 : 0.05))
        .attr("text-anchor", "middle")  
        .text(patient_percentile.toFixed(0))
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .style('fill', 'rgb(55,170, 242)')
        .style('opacity', 1)
        .style('z-index', 3);
    
    
    // LINES WHILE HOVERING 
    var focus = g.append('g')
		.attr('class','focus')
		.style('display', 'none') 

	focus.append('line')
		.attr('class', 'x-hover-line hover-line')
		.attr('y1', 0)
		.attr('y2', height);
    
    focus.append('line')
		.attr('class', 'y-hover-line hover-line')
		.attr('x1', 0)
		.attr('x2', 0)

    focus.append('circle')
        .style('stroke', 'rgb(248,248,248)')
        .style('stroke-width', 2)
        .attr('r', 4)
    /*    
    // TOOLTIP INIT
    focus.append("rect")
        .attr("class", "tooltip")
        .attr("width", '4.5rem')
        .attr("height", '3.2rem')
        .attr("x", 10)
        .attr("y", -55)
        .attr("rx", 4)
        .attr("ry", 4)
        .attr('fill', 'rgb(230,230,230)')
        .attr('stroke', '#000');

    focus.append('text')
        .attr('class', 'text1 info-text')
        .attr('x', 15)
        .attr('y', -35)
        .attr('font-size', '14px')//'0.82rem')

    focus.append('text')
        .attr('class', 'text2 info-text')
        .attr('x', 15)
        .attr('y', -15)
        .attr('font-size', '14px')//'0.82rem')
    */ 
    // SETUP OVERLAY TO TRACK MOUSE MOVEMENTS
    svg.append('rect')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
        .attr('class', 'overlay')
        .attr('width', width)
        .attr('height', height)
        .on('mouseover', function(){focus.style('display', null);})
        .on('mouseout', function(){focus.style('display', 'none');})
        .on('mousemove', mousemove)
    // END TOOLTIP INIT
    
    function mousemove(){
        var x0 = x.invert(d3.mouse(this)[0]),
          i = bisectPercentile(data, x0, 1),
          d0 = data[i - 1],
          d1 = data[i],
          d = x0 - d0.percentile >= d1.percentile - x0 ? d1 : d0;
          //shift point
          focus.attr("transform", "translate(" + x(d.percentile) + "," + y(d.y) + ")");
          //format text
          //focus.select(".text1").html(function() { return '%ile: ' + d.percentile; });
          //focus.select(".text2").html(function() { return 'PRS: ' + d.y.toFixed(2); });
          // add x/y axis trace lines
          focus.select(".x-hover-line").attr("y2", height - y(d.y));
          focus.select(".y-hover-line").attr("x2", - (x(d.percentile)));
    }
    /* 
    // TITLE 
    svg.append("text")
        .attr("x", (width / 2))             
        .attr("y", 0 - (margin.top / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "18px") 
        .text("Risk Score Percentile");
    */
}
