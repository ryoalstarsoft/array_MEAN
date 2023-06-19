/**
 *
 */
function BarChart(selector, dataSet, options) {

    this._categories = dataSet.categories;

    this._categoryData = $.extend(true, [], this._categories);
    this._data = dataSet.data;
    this._options = options;
    this._padding = options.padding || 0.2;
    this._precise = options.precise || 2;

    var self = this;

    var colors = d3.scale.category20().range();
    if (dataSet.colors) {
        for(var i = 0; i < dataSet.colors.length; i ++) {
            colors[i] = dataSet.colors[i];
        }
    }

    this._colors = {};
    i = 0;
    this._data.forEach(function(col) {
        col.forEach(function(d) {
            if (!self._colors[d.label]) self._colors[d.label] = colors[i];
            i = (i+1) % colors.length;
        });
    });

    this.sortData();

    this._chartData = this.getChartData();


    var digitCount = this.getMaxValue().toString().length;

    this._margin = {
        top : 25,
        right : 15,
        bottom : 144 + $('.filter-bar').height(),  //Add more margin if filters present - margin bottom can be 15 if we're not showing the labels
        // bottom: 10,
        left : options.horizontal ? 120 : Math.max(10 * digitCount, 50) + 36 // 2em axis label = 18px * 2 = 36
    };

    if ('margin' in options) {
        for (var side in options.margin) {
            this._margin[side] = options.margin[side];
        }
    }


    /**
     * Chart tooltip.
     * @private
     * @member {Tooltip}
     */
    this._tooltip = new Tooltip();
    /**
     * Chart container.
     * @private
     * @member {Selection}
     */
    this._container = d3.select(selector);

    // Vertically-responsive
    var container = $(this._container.node());

    const defaultMinHeight = 460;
    container.css('min-height', function() {
        return defaultMinHeight;
    });

    var dimension = this._container.node().getBoundingClientRect();

    this._showLabels;



    // /*Set a minimum width for the barchart in cases where # of labels exceeds 18*/
    if (dimension.width < 580 && self._categoryData.length > 16) {
        this._outerWidth = 580;
    } else {
        this._outerWidth = dimension.width;
    }


    this._innerWidth = this._outerWidth - this._margin.left - this._margin.right;
    this._outerHeight = window.innerHeight - container.offset().top - 30;

    // minimum height for mobile view
    if(this._outerHeight < defaultMinHeight) {
        this._outerHeight = defaultMinHeight
    }
    this._innerHeight = this._outerHeight - this._margin.top - this._margin.bottom;

    // anything beyond this and the axis labels get too squished
    if(options.horizontal == false) {
        this._showYLabels = true;
        if(this._outerWidth/self._categoryData.length < 16) {
            this._showXLabels = false;
        } else {
            this._showXLabels = true;
        }

    } else if(options.horizontal == true){
        this._showXLabels = true;
        if(this._outerHeight/self._categoryData.length < 18) {
            this._showYLabels = false;
            this._margin.left = 54; // 3em @ 18px
            this._innerWidth = this._outerWidth - this._margin.left - this._margin.right; // recalc
        } else {
            this._showYLabels = true;
        }
    }



    this._svg = this._container.append('svg')
        .attr('height', this._outerHeight)
        .attr('width', this._outerWidth)
        .attr('viewbox', '0, 0, ' + this._outerWidth + ", " + this._outerHeight)
        .attr('preserveAspectRatio', 'none')

    this._canvas = this._svg.append('g')
        .attr('transform', 'translate(' + this._margin.left + ', ' + this._margin.top + ')');

    this._xAxisContainer = this._canvas.append('g')
      .attr('class', 'axis axis-x')
      .attr('transform', this.getXAxisTransform())
      .call(this.getXAxis())

    if(options.horizontal == false) {
        this.rotateLabel();
    }

    // xAxis label
    this._xAxisContainer.append('text')
        // place at bottom of labels
        .attr('transform', 'translate(' + (this._innerWidth * 0.5) + ', ' + this._xAxisContainer.node().getBBox().height + ')')
        .attr("dy", this._showXLabels ? "1.5em" : "1em") // and adjust
        .attr("text-anchor", "middle")
        .text(this._options.horizontal ? aggregateBy : groupBy)
        .classed("label", true);

    this._yAxisContainer = this._canvas.append('g')
      .attr('class', 'axis axis-y')
      .attr('transform', this.getYAxisTransform())
      .call(this.getYAxis());

    if(options.horizontal == true) {
        this.rotateYLabel();
        this.rotateXLabel();
    }

    // yAxis label
    this._yAxisContainer.append('text')
        .attr('transform', // put at svg left, not yAxisContainer
            'translate(' + -this._margin.left + ', ' + (this._innerHeight * 0.5) + ')' +
            'rotate(-90)')
        .attr("dy", "1.5em") // and adjust
        .attr("text-anchor", "middle")
        .text(this._options.horizontal ? groupBy : aggregateBy)
        .classed("label", true);

    /**
     * Append bar's series.
     */
    this._bars = this._canvas.append('g')
        .attr('class', 'bars')
        .selectAll('g.series')
        .data(this._chartData)
        .enter()
        .append('g')
        .attr('class', 'series')
        .selectAll('rect.bar')
        .data(function(d, i) {
            return d;
        }).enter()
        .append('rect')
        .attr('class', 'bar')
        .style('fill', function(d, i, j) {
            return self._colors[d.label];
        }).on('mouseenter', function(d, i, j) {
            self._barMouseEnterEventHandler(this, d, j, categoriesAndData)
        }).on('mouseout', function(d, i, j) {
            self._barMouseOutEventHandler(this, d, i, j);
        }).on('click', function(d, j, i){
            self._barClickEventHandler(categoriesAndData, j, i);
        });
    /*
     * Legend Data
     */
    var legendList = d3.select('.legend-list');
    var legendListItem = legendList.selectAll('.legend-list-item')
        .data(this.getLegendData())
        .enter()
        .append('li')
        .attr('class', 'legend-list-item');

    var legendListLink = legendListItem.append('a');

    legendListLink.append('span')
        .attr('class', 'legend-dot')
        .style('background-color', function(d, i) {
            return self._colors[d.label];
        });

    legendListLink.attr('class', 'legend-list-link')
        .attr('href','javascript:;')
        .on('click',function(d) {
            var queryParamJoinChar = routePath_withoutFilter.indexOf('?') !== -1? '&' : '?';
            var filterObjForThisFilterColVal = constructedFilterObj(filterObj, stackBy, d.label, false);
            var filterJSONString = $.param(filterObjForThisFilterColVal);
            var urlForFilterValue = routePath_withoutFilter + queryParamJoinChar + filterJSONString;

            window.location = urlForFilterValue;
        })
        .on('mouseover', function(d, i) {
            d3.select(this)
                .classed('active', true);

            d3.select(selector)
                .selectAll('svg')
                .selectAll('rect.bar')
                .style('opacity', function(bar) {
                    if (bar.label == d.label) {
                        return 1;
                    } else {
                        return 0.25;
                    }
                });
        })
        .on('mouseout', function(d, i) {
            d3.select(selector)
                .selectAll('svg')
                .selectAll('rect.bar')
                .style('opacity', 1);
        })
        .append('span')
        .html(function(d) {
            return d.label;
        });

    this._animate();
};
var categoriesAndData;

/*
 * Sort By Order
 */
BarChart.prototype.sortData = function() {
    var self = this;
    categoriesAndData = this._categoryData
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
            return d;
        });

    this._categories = [];
    this._data = [];
    for(var i = 0; i < categoriesAndData.length; i++) {
        this._categories.push(categoriesAndData[i][0])
        this._data.push(categoriesAndData[i][1])
    }
}

/**
 * Normalize input data.
 * @returns {Object[]}
 */
BarChart.prototype.normalize = function() {

    return this._data.map(function(series) {
        /*
         * Get column max value.
         */
        var columnMax = d3.sum(series.map(function(d) {
            return d.value;
        }))
        /*
         * Devide every column's value to the max value.
         */
        return series.map(function(d) {
            var newD = Object.assign({}, d);
            newD.value = newD.value / columnMax;
            return newD;
        });
    });
};


/**
 * Get numeric domain max value.
 * @returns {Number}
 */
BarChart.prototype.getMaxValue = function() {

    if (this._options.normalize) {
        return 1;
    }
    /*
     * Evaluate max value.
     */
    return d3.max(this._chartData.reduce(function(values, series) {
        return values.concat(d3.sum(series.map(function(d) {
            return d.value;
        })));
    }, []));
};


BarChart.prototype.getValueFormatter = function() {

    var self = this;

    /* Truncate numbers */
    var _abbreviateNumber = function(num, fixed) {
        if (num === null) { return null; } // terminate early
        if (num === 0) { return '0'; } // terminate early
        fixed = (!fixed || fixed < 0) ? 0 : fixed; // number of decimal places to show
        var b = (num).toPrecision(2).split("e"), // get power
            k = b.length === 1 ? 0 : Math.floor(Math.min(b[1].slice(1), 14) / 3), // floor at decimals, ceiling at trillions
            c = k < 1 ? num.toFixed(0 + fixed) : (num / Math.pow(10, k * 3) ).toFixed(1 + fixed), // divide by power
            d = c < 0 ? c : Math.abs(c), // enforce -0 is 0
            e = d + ['', 'K', 'M', 'B', 'T'][k]; // append power
        return e;
    }

    /* Comma separate numbers */
    var _castToString = function(number) {
        parts = number.toString().split(".");
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return parts.join(".");
    }

    if (this._options.normalize) {
        return function(d) {
            return d3.round(d*100,self._precise) + "%"
        };
    } else {
        return function(d) {
            // var number = d3.round(d,self._precise);
            // return _castToString(number);
            var number = d3.round(d,self._precise);
            return _abbreviateNumber(number, 0);
        }
    }
};


/**
 * Bar mouse in event handler.
 * @param {SVGElement} barElement - bar SVG node
 * @param {Object} barData - bar data
 * @param {Integer} i - bar number within series
 * @param {Integer} j - series number
 */
BarChart.prototype._barMouseEnterEventHandler = function(barElement, d, j, categoriesAndData) {
    var label = d.label;
    var value = d.value;
    var category = categoriesAndData[j][0];

    this._canvas.selectAll('rect.bar')
        .filter(function() {
            return this != barElement;
        }).style('opacity', 0.2);

    var formatter = this.getValueFormatter();



    this._tooltip.setContent(
        '<div>' +
            '<div class="scatterplot-tooltip-title">' +
                '<div>' + groupBy + ': ' + category + '</div>' +
            '</div>' +
            '<div class="scatterplot-tooltip-content-label">' + stackBy + ': ' + label + '</div>' +
            '<div class="scatterplot-tooltip-content-label">' + aggregateBy + ': ' + formatter(value) + '</div>' +
        '</div>')
        .setPosition('top')
        .show(barElement);
};


/**
 * Bar mouse out event handler.
 * @param {SVGElement} barElement - bar SVG node
 * @param {Object} barData - bar data
 * @param {Integer} i - bar number within series
 * @param {Integer} j - series number
 */
BarChart.prototype._barMouseOutEventHandler = function(barElement, barData, i, j) {

    this._canvas.selectAll('rect.bar')
        .filter(function() {
            return this != barElement;
        }).style('opacity', 1);

    this._tooltip.hide();
};

BarChart.prototype._barClickEventHandler = function(categoriesAndData, stackByIndex, groupByIndex) {
    var queryParamJoinChar = routePath_withoutFilter.indexOf('?') !== -1? '&' : '?';
    var filterCols = [groupBy, stackBy]
    var filterVals = [categoriesAndData[groupByIndex][0], categoriesAndData[groupByIndex][1][stackByIndex].label]
    var filterObjForThisFilterColVal = constructedFilterObj(filterObj, filterCols, filterVals, false);
    var filterJSONString = $.param(filterObjForThisFilterColVal);
    var urlForFilterValue = routePath_withoutFilter + queryParamJoinChar + filterJSONString;

    window.location = urlForFilterValue;

}


/**
 * Get chart data.
 * @returns {Object[][]}
 */
BarChart.prototype.getChartData = function() {
    if (this._options.normalize) {
        return this.normalize();
    } else {
        return this._data;
    }
};

/**
 * Get legend data.
 * @returns {Object[][]}
 */
BarChart.prototype.getLegendData = function() {
    var data = {};
    var self = this;

    this._data.forEach(function(col) {
        col.forEach(function(d) {
            if (!data[d.label]) data[d.label] = d;
        });
    });

    return Object.keys(data).map(function(key) {
        return data[key];
    });
};

/**
 * Factory method.
 * @param {String} selector
 * @param {Object} dataSet
 * @param {Object} options
 * @returns {BarChart}
 */
BarChart.getInstance = function(selector, dataSet, options) {

    $(selector).empty();
    if (options.horizontal === true) {
        return new HorizontalBarChart(selector, dataSet, options);
    } else {
        return new VerticalBarChart(selector, dataSet, options);
    }
};

BarChart.prototype.updateSortDirection = function(sortDirection) {
    if (typeof sortDirection !== undefined) {
        this._options.sortDirection = sortDirection;
    }
    // animate for sort has to be called before rotate label otherwise, it'll overwrite style attributes
    this._animateForSort();
    if(this._options.horizontal == false) {
        this.rotateLabel();
    } else {
        this.rotateXLabel();
        this.rotateYLabel();
    }
};
