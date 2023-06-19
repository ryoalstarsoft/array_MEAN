/**
 * Vertical bar chart implementation.
 * @param {String} selector
 * @param {Object} dataSet
 * @param {Object} options
 */
function VerticalBarChart(selector, dataSet, options) {

    BarChart.call(this, selector, dataSet, options);
}


VerticalBarChart.prototype = Object.create(BarChart.prototype);


VerticalBarChart.prototype._animate = function () {

    var self = this;

    this._bars.attr('width', function (d, i, j) {
        return self.getBarWidth(d, i, j);
    }).attr('x', function (d, i, j) {
        return self.getBarX(d, i, j);
    }).attr('height', 0)
        .attr('y', this._innerHeight);

    this._bars.transition()
        .duration(1000)
        .attr('height', function (d, i, j) {
            return isNaN(self.getBarHeight(d, i, j)) ? 0 : self.getBarHeight(d, i, j);
        }).attr('y', function (d, i, j) {
        return isNaN(self.getBarY(d, i, j)) ? 0 : self.getBarY(d, i, j);
    });
};

VerticalBarChart.prototype._animateForSort = function () {

    var self = this;
    var originalCategories = this._categories; // simple fix
    var newCategories = this._categories
        .reduce(function(o, v, i) {
            o.push([v, self._data[i]]);
            return o;
        }, [])
        .sort(!this._options.sortDirection ? function(a, b) {
            return a[1].reduce(function (sum, obj) {
                    return sum + obj.value;
                }, 0) - b[1].reduce(function (sum, obj) {
                    return sum + obj.value;
                }, 0);
        } : function(a, b) {
            return b[1].reduce(function (sum, obj) {
                    return sum + obj.value;
                }, 0) - a[1].reduce(function (sum, obj) {
                    return sum + obj.value;
                }, 0);
        })
        .map(function (d) {
            return d[0];
        });


    // Copy-on-write since tweens are evaluated after a delay.
    var x0 = d3.scale.ordinal()
        .rangeBands([0, this._innerWidth], this._padding)
        .domain(newCategories)
        .copy();

    var delay = function(d, i, j) { return j * 50; };

    this._bars.transition()
        .duration(750)
        .delay(delay)
        .attr("x", function(d, i, j) {
            return x0(self._categories[j]);
        });

    this._categories = newCategories;

    this._xAxisContainer.transition()
        .duration(750)
        .call(self.getXAxis())
        .selectAll("g")
        .delay(delay);

    this._categories = originalCategories; // simple fix
};

VerticalBarChart.prototype.rotateLabel = function () {
    // rotate x-axis labels 90 degrees or hide
    if(this._showXLabels) {
        return this._xAxisContainer.selectAll("text:not(.label)") // do not rotate axis label
            .attr("dx", "-.8em")
            .attr("dy", "-.2em")
            .style("text-anchor", "end")
            .attr("transform", "rotate(-90)" );
    } else {
        return this._xAxisContainer.selectAll("g")
        .style("visibility", "hidden")
    }
};


VerticalBarChart.prototype.getXScale = function () {
    return this._xScale = d3.scale.ordinal()
        .rangeBands([0, this._innerWidth], this._padding)
        .domain(this._categories);
};


VerticalBarChart.prototype.getXAxis = function () {
    return d3.svg.axis()
        .scale(this.getXScale(this._innerWidth))
        .tickFormat(function(d) {
            var maxlength = 10;
            if (d.length > maxlength) {
                d = d.substring(0, maxlength) + '…'; // \u8230
            }
            return d;
        })
        .orient('bottom');
};


VerticalBarChart.prototype.getXAxisTransform = function () {

    return 'translate(0, ' + this._innerHeight + ')';
};


VerticalBarChart.prototype.getYScale = function () {

    return this._yScale = d3.scale.linear()
        .range([this._innerHeight, 0])
        .domain([0, this.getMaxValue()]);
};


VerticalBarChart.prototype.getYAxis = function () {

    return d3.svg.axis()
        .scale(this.getYScale())
        .orient('left')
        .tickFormat(this.getValueFormatter());
};


VerticalBarChart.prototype.getYAxisTransform = function () {

    return 'translate(0, 0)';
};


VerticalBarChart.prototype.getBarHeight = function (d, i, j) {

    return this._innerHeight - this._yScale(d.value);
};


VerticalBarChart.prototype.getBarWidth = function (d, i, j) {

    return this._xScale.rangeBand();
};


VerticalBarChart.prototype.getBarX = function (d, i, j) {

    return this._xScale(this._categories[j]);
};


VerticalBarChart.prototype.getBarY = function (d, i, j) {

    var y = 0;

    for (var k = 0; k <= i; k++) {
        y += this._innerHeight - this._yScale(this._chartData[j][k].value);
    }

    return this._innerHeight - y;
};
