/**
 * Scatterplot grouped view.
 * @public
 * @param {scatterplot.chart} chart
 * @constructor
 */
scatterplot.view.grouped = function (chart) {
    /*
     * Call parent class constructor.
     */
    scatterplot.view.main.call(this, chart);
};


scatterplot.view.grouped.prototype = Object.create(scatterplot.view.main.prototype);


/**
 * @override
 */
scatterplot.view.grouped.prototype.getDensityMatrix = function (data, xTicks, yTicks) {
    /*
     * Definde reference to the chart.
     */
    var chart = this._chart;
    /*
     * Get data x and y values.
     */
    var xValues = data.map(function (d) {
        return Number(chart._xAccessor(d));
    });
    var yValues = data.map(function (d) {
        return Number(chart._yAccessor(d));
    });
    /*
     * Get density matrix.
     */
    return new GroupingAlgorithm()
        .setUp(xValues, xTicks, yValues, yTicks)
        .execute();
};


/**
 * Prepare data for representation.
 * @private
 * @param {Object[]} data
 * @returns
 */
scatterplot.view.grouped.prototype._prepareData = function (data) {
    /*
     * Definde reference to the chart.
     */
    var chart = this._chart;
    /*
     * Get axes ticks.
     */
    var xTicks = chart._xAxis.tickValues().slice(1);
    var yTicks = chart._yAxis.tickValues().slice(1);
    /*
     * Round the tick values
     */
    xTicks = xTicks.map(Math.round);
    yTicks = yTicks.map(Math.round);
    /*
     * Calculate axes intervals width.
     */
    var xStep = chart._innerWidth / xTicks.length;
    var yStep = chart._innerHeight / yTicks.length;
    /*
     * Generate density matrix filled with values.
     * The matrix rows and columns equals to the chart's rows and
     * columns number after columns reversing.
     */
    var densityMatrix = this.getDensityMatrix(data, xTicks, yTicks)
        .map(function (column) {
            return column.reverse();
        })
    /*
     * Find biggest group value.
     */
    var maxGroup = densityMatrix.reduce(function (max, row) {
        return Math.max(max, d3.max(row));
    }, 0);
    /*
     * Create radius scale function.
     */
    var maxRadius = Math.min(xStep, yStep) / 2 + Math.min(chart._margin.top, chart._margin.right, chart._margin.bottom, chart._margin.left);

    var radiusScale = d3.scale.linear()
        .domain([0, 1, maxGroup])
        .range([0, chart._radius, maxRadius]);
    /*
     * Return chart actual data.
     */
    return densityMatrix.reduce(function (columns, column, i) {
        return columns.concat(column.map(function (density, j) {
            return {
                i: i,
                j: j,
                density: density,
                radius: radiusScale(density)
            };
        }));
    }, []).filter(function (d) {
        return d.radius > 0;
    }).sort(function (a, b) {
        if (a.density < b.density) {
            return 1;
        } else if (a.density > b.density) {
            return -1;
        } else {
            return 0;
        }
    });
};


/**
 * @override
 */
scatterplot.view.grouped.prototype.render = function (data) {
    /*
     * Log data set size.
     */
    console.log(data.length + ' objects received')
    /*
     * Definde reference to the chart.
     */
    var chart = this._chart;
    /*
     * Stash reference to this object.
     */
    var self = this;
    /*
     * Get axes ticks.
     */
    var xTicks = chart._xAxis.tickValues().slice(1);
    var yTicks = chart._yAxis.tickValues().slice(1);
    /*
     * Round the tick values
     */
    xTicks = xTicks.map(Math.round);
    yTicks = yTicks.map(Math.round);
    /*
     * Calculate axes intervals width.
     */
    var xStep = chart._innerWidth / xTicks.length;
    var yStep = chart._innerHeight / yTicks.length;
    /*
     * Select bubbles.
     */
    data = this._prepareData(data);
    /*
     * Select bubbles.
     */
    var bubbles = chart._canvas.selectAll('circle.bubble')
        .data(data, function (d, i) {
            return d.i + 'x' + d.j;
        });
    /*
     * Move existent bubbles.
     */
    bubbles.transition()
        .duration(1000)
        .attr('cx', function (d) {
            return xStep * d.i + xStep / 2;
        }).attr('cy', function (d) {
        return yStep * d.j + yStep / 2;
    }).attr('r', function (d) {
        return d.radius;
    });
    /*
     * Get URL params as object.
     */
    var params = convertQueryStringToObject(location.search.substring(1));
    /*
     * Render new bubbles.
     */
    bubbles.enter()
        .append('a')
        .attr('xlink:href', function (d, i) {
            /*
             * Add x axis filed params.
             */
            params[chart._xLabel] = JSON.stringify({
                min: (d.i - 1) in xTicks ? d3.round(xTicks[d.i - 1]) : 0,
                max: d.i == xTicks.length - 1 ? d3.round(xTicks[d.i] + 0.5) : d3.round(xTicks[d.i])
            });
            /*
             * Add y axis filed params.
             */
            params[chart._yLabel] = JSON.stringify({
                min: (yTicks.length - d.j - 2) in yTicks ? d3.round(yTicks[yTicks.length - d.j - 2]) : 0,
                max: d.j == 0 ? d3.round(yTicks[yTicks.length - d.j - 1] + 0.5) : d3.round(yTicks[yTicks.length - d.j - 1])
            });
            /*
             * Complose bubble URL.
             */
            var urlParams = decodeURIComponent($.param(params));
            /*
             * Return bubble URL.
             */
            if (chart._galleryView) {
                var substringLength = location.pathname.length - "scatterplot".length;
                return location.pathname.substring(0, substringLength) + 'gallery?' + urlParams;
            }
            return location.pathname + '?' + urlParams;
        }).append('circle')
        .attr('class', 'bubble')
        .style('opacity', 0.5)
        .style('fill', chart._color)
        .attr('cx', function (d, i) {
            return xStep * d.i + xStep / 2;
        }).attr('cy', function (d, i) {
        return yStep * d.j + yStep / 2;
    }).attr('r', 0)
        .on('mouseover', function (d) {
            chart._bubbleMouseOverEventHandler(this, d);
        }).on('mouseout', function (d) {
        chart._bubbleMouseOutEventHandler(this);
    }).transition()
        .duration(1000)
        .attr('r', function (d) {
            return d.radius;
        });
    /*
     * Remove absent bubbles.
     */
    bubbles.exit()
        .transition()
        .duration(1000)
        .attr('r', 0)
        .remove();
};


/**
 * @override
 */
scatterplot.view.grouped.prototype.showTooltip = function (bubble, data) {
    /*
     * Stash reference to the chart.
     */
    var chart = this._chart;
    /*
     * Get axes ticks values.
     */
    var xTicks = chart._xAxis.tickValues().slice(1);
    var yTicks = chart._yAxis.tickValues().slice(1);
    /*
     * Round the tick values
     */
    xTicks = xTicks.map(Math.round);
    yTicks = yTicks.map(Math.round);
    /*
     * Evaluate intervals depending on data provided. Remove spaces.
     */
    var xInterval = String(((data.i - 1) in xTicks ? d3.round(xTicks[data.i - 1]) : 0) + ' &ndash; ' + d3.round(xTicks[data.i]));
    var yInterval = String(((yTicks.length - data.j - 2) in yTicks ? d3.round(yTicks[yTicks.length - data.j - 2]) : 0) + ' &ndash; ' + d3.round(yTicks[yTicks.length - data.j - 1]));
    /*
     * Show tooltip.
     */

    this._tooltip.setContent(
        // If data description specifies tooltip terminology it will be displayed, otherwise it will default to  'Records'
            '<div class="scatterplot-tooltip-container">' +
            '<div class="scatterplot-tooltip-title">' +
            '<div>X: ' + xInterval + ' ' + chart._xLabel.replace(new RegExp('_', 'g'), ' ') + '</div>' +
            '<div>Y: ' + yInterval + ' ' + chart._yLabel.replace(new RegExp('_', 'g'), ' ') + '</div>' +
            '</div>' +
            '<div class="scatterplot-tooltip-content">' + data.density + ' ' + (chart._metaData.fe_scatterplot_tooltip_term ? chart._metaData.fe_scatterplot_tooltip_term : 'Records') + ' </div>' +
            '</div>')
        .setPosition('top')
        .setOffset(chart._radius / 2)
        .show(bubble);

};