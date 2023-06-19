/**
 * @constructor
 * @param {Object{data, labels, colors}} data, {Object{}} options
 */
linechart.viewport = function (data, options) {
    /**
     * Chart data.
     * @private
     * @member {Object[][]}
     */
    if (options.groupBy_isDate == "false") {
        options.groupBy_isDate = false;
    } else {
        options.groupBy_isDate = true;
    }
    this._data = data.data.map(function (lineData) {
        return lineData.map(function (d) {
            if (options.groupBy_isDate !== false) {
                d.date = new Date(d.date);
            }
            return d;
        });
    });
    /**
     * Series names.
     * @private
     * @member {Object[]}
     */
    this._labels = data.labels;

    /*
     * Url information to redirect when clicking tick on the x-axis
     */
    this._options = options;
    /**
     * Data set dates domain.
     * @private
     * @member {Integer[]}
     */
    this._dataDomain = this._getDomain(this._data);
    /**
     * Chart container.
     * @private
     * @member {Selection}
     */
    this._container = undefined;
    /**
     * Chart canvas width.
     * @private
     * @member {Number}
     */
    this._innerWitdh = undefined;
    /**
     * Chart canvas height.
     * @private
     * @member {Number}
     */
    this._innerHeight = undefined;
    /**
     * Chart SVG width.
     * @private
     * @member {Number}
     */
    this._outerWitdh = undefined;
    /**
     * Chart SVG height.
     * @private
     * @member {Number}
     */
    this._outerHeight = undefined;
    /**
     * Chart SVG element.
     * @private
     * @member {Selection}
     */
    this._svg = undefined;
    /**
     * Chart main g element.
     * @private
     * @member {Selection}
     */
    this._canvas = undefined;
    /**
     * Custom date format in X axis
     */
    if (this._options.groupBy_isDate) {
        /**
        * Chart x scale function.
        * @private
        * @member {Function}
        */
        this._xScale = d3.time.scale();   
        /**
        * Custom date format in X axis
        */ 
        this._formattedData = d3.time.format.multi([
            [".%L", function (d) {
                return d.getMilliseconds();
            }],
            [":%S", function (d) {
                return d.getSeconds();
            }],
            ["%I:%M", function (d) {
                return d.getMinutes();
            }],
            ["%I %p", function (d) {
                return d.getHours();
            }],
            ["%a %d", function (d) {
                return d.getDay() && d.getDate() != 1;
            }],
            ["%b %d", function (d) {
                return d.getDate() != 1;
            }],
            ["%B", function (d) {
                return d.getMonth();
            }],
            ["'%y", function () {
                return true;
            }]
        ]);
    } else {
        /**
        * Chart x scale function.
        * @private
        * @member {Function}
        */
        this._xScale = d3.scale.linear();
        this._formattedData = d3.format(".2");
    }
    /**
     * Chart y scale function.
     * @private
     * @member {Function}
     */
    this._yScale = d3.scale.linear();
    /**
     * Chart x axis.
     * @private
     * @member {Function}
     */
    this._xAxis = d3.svg.axis()
        .scale(this._xScale)
        .orient('bottom')

        .tickFormat(this._formattedData);
    /**
     * Chart y axis.
     * @private
     * @member {Function}
     */
    this._yAxis = d3.svg.axis()
        .scale(this._yScale)
        .tickPadding(25)
        .orient('left');
    /**
     * Chart x axis container.
     * @private
     * @member {Selection}
     */
    this._xAxisContainer = undefined;
    /**
     * Chart y axis container.
     * @private
     * @member {Selection}
     */
    this._yAxisContainer = undefined;
    /**
     * bisector.
     * @private
     * @member {Function}
     */
    this._bisect = function (a, x) {
        lo = 0;
        hi = a.length;
        while (lo < hi) {
            var mid = lo + hi >>> 1;
            if (a[mid] < x) lo = mid + 1; else hi = mid;
        }
        if (lo > 0 && (x - a[lo - 1]) < (a[lo] - x)) lo -= 1;
        return lo;
    };
    /**
     * Lines color set.
     * @private
     * @member {String[]}
     */
    this._colors = d3.scale.category20().range();
    if (data.colors) {
        for (var i = 0; i < data.colors.length; i++) {
            this._colors[i] = data.colors[i];
        }
    }


    /*
     * Stash reference to this object.
     */
    var self = this;
    /**
     * Line generator.
     * @private
     * @member {Function}
     */
    this._lineGenerator = d3.svg.line()
        .x(function (d) {
            return self._xScale(d.date);
        }).y(function (d) {
            return self._yScale(d.value);
        });
    /**
     * Chart margins.
     * @private
     * @member {Object}
     */
    this._margin = {
        top: 25,
        right: 15,
        bottom: 20,
        left: 70
    };
    /**
     * Chart tooltip.
     * @private
     * @member {Tooltip}
     */
    this._tooltip = new Tooltip();

    /**
     * X-Axis highlight tooltip.
     * @private
     * @member {Tooltip}
     */
    this._xAxisHighlight = new Tooltip();
};


linechart.viewport.prototype = Object.create(linechart.base.prototype);


/**
 * Render chart.
 * @public
 * @param {String} selector
 * @returns {linechart.viewport}
 */
var mouseLeft = true;
linechart.viewport.prototype.render = function (container) {
    /*
     * Stash reference to this object.
     */
    var self = this;
    /*
     * Select chart container.
     */
    this._container = container;
    /*
     * Check container is founded by provided selector.
     */
    if (this._container.size() === 0) {
        throw new Error('Cannot find HTML element by "' + selector + '" selector');
    }
    /*
     * Append SVG element.
     */
    this._svg = this._container.append('svg')
        .attr('class', 'viewport');
    /*
     * Append chart canvas.
     */
    this._canvas = this._svg.append('g')
        .attr('transform', 'translate(' + this._margin.left + ', ' + this._margin.top + ')');
    /*
     * Append x axis container.
     */
    this._xAxisContainer = this._canvas.append('g')
        .attr('class', 'axis x-axis');
    /*
     * Append y axis container.
     */
    this._yAxisContainer = this._canvas.append('g')
        .attr('class', 'axis y-axis');
    /*
     * Render line's containers.
     */
    this._series = this._canvas.selectAll('g.series')
        .data(this._data)
        .enter()
        .append('g')
        .attr('pointer-events', 'none')
        .attr('class', 'series');
    /*
     * Render empty line.
     */
    this._lines = this._series.append('path')
        .attr('class', 'line')
        .style('stroke', function (d, i) {
            return self._colors[i];
        });
    /*
     * Render line pointer.
     */
    this._linePointer = this._canvas.append('line')
        .attr('class', 'pointer')
        .attr('y1', 0)
        .style('display', 'none');
    /*
     * Append mouse events receiver.
     */
    this._receiver = this._canvas.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .style('fill', 'transparent')
        .on('mouseenter', function () {
            if(mouseLeft == true) {
                self._mouseEnterEventHandler();
            } else {
                setTimeout(function () {
                    self._mouseEnterEventHandler();
                }, 2000);
            }
        }).on('mouseleave', function () {
            setTimeout(function () {
                self._mouseOutEventHandler();
            }, 2000);
        }).on('mousemove', function () {
            self._mouseMoveEventHandler();
        }).on('click', function () {
            if (self._options.redirectBaseUrl) {
                /*
                 * Get mouse coordinate relative to parent element.
                 */
                var x = d3.mouse(self._receiver.node())[0];
                /*
                 * Get date value under mouse pointer.
                 */
                var invertedData = self._xScale.invert(x);
                /*
                 * Get nearest to x date's index.
                 */
                // if (self._options.groupBy_isDate) {
                //     invertedData = invertedData.getTime();  
                // }
                var index = self._bisect(self._dataDomain, invertedData);
                window.location.href = self._options.redirectBaseUrl +
                        moment(invertedData, moment.ISO_8601).format(self._options.outputInFormat);

            }
        });
    /*
     * Set up chart dimension.
     */
    this.resize();
    /*
     * Populate with data.
     */
    this.update();

    return this;
};



/**
 * Viewport mouse enter event handler.
 * @private
 */
linechart.viewport.prototype._mouseEnterEventHandler = function () {
    mouseLeft = false;
    /*
     * Append tooltip to the document body.
     */
    this._tooltip.setOn(this._svg.node())
        .setWidth(335)
        .setOffset('top', -10);
    /*
     * Append x-axis highlight to the document body.
     */
    this._xAxisHighlight.setOn(this._svg.node(), 'xaxis-highlight')
        // .setWidth(30) // allow width to be set by content
        .setOffset('top', -this._innerHeight - 30);
    /*
     * Show line pointer.
     */
    this._linePointer.style('display', null);
};


/**
 * Viewport mouse out event handler.
 * @private
 */
linechart.viewport.prototype._mouseOutEventHandler = function () {
    mouseLeft = true;
    /*
     * Hide tooltip.
     */
    this._tooltip.hide();
    /*
     * Hide x-axis highlight.
     */
    this._xAxisHighlight.hide();
    /*
     * Remove all circles from the series lines.
     */
    this._canvas.selectAll('circle.data-point')
        .remove();
    /*
     * Hide line pointer.
     */
    this._linePointer.style('display', 'none');
};


/**
 * Viewport mouse move event handler.
 * @private
 */
linechart.viewport.prototype._mouseMoveEventHandler = function () {

    /*
     * Stash reference to this object.
     */
    var self = this;
    /*
     * Get mouse coordinate relative to parent element.
     */
    var x = d3.mouse(this._receiver.node())[0];
    /*
     * Get date value under mouse pointer.
     */
    var invertedData = this._xScale.invert(x);
    /*
     * Get nearest to x index.
     */
    if (self._options.groupBy_isDate) {
        invertedData = invertedData.getTime();
    }
    var index = self._bisect(this._dataDomain, invertedData);

    if (self._options.groupBy_isDate) {
        bisectedData = new Date(this._dataDomain[index]);
    } else {
        bisectedData = this._dataDomain[index];
    }
    /*
     * Create series current values list.
     */
    var tooltipData = this._data.reduce(function (values, dataSet) {
        /*
         * Push value into summary array, if any or zero otherwise.
         */
        var dataPoint = _.find(dataSet, ['date', bisectedData]);
        if (dataPoint) {
            var number = dataPoint.value;
            var parts = number.toString().split(".");
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            dataPoint.value = parts.join(".");
            values.push(dataPoint);
        } else {
            values.push({value: 0});
        }

        return values;
    }, []);
    /*
     * Change tooltip position.
     */
    if (x < this._innerWidth / 2) {
        this._tooltip.setPosition('right')
            .setOffset({
                left: 335 + this._margin.right + 10,
                right: 0
            });
    } else {
        this._tooltip.setPosition('left')
            .setOffset({
                right: 335 + this._margin.left + 10,
                left: 0
            });
    }
    /*
     * Move line pointer.
     */
    this._linePointer.attr('y2', this._innerHeight)
        .attr('x1', this._xScale(bisectedData))
        .attr('x2', this._xScale(bisectedData));
    /*
     * Move x-axis highlight
     */
    this._xAxisHighlight.setPosition('left')
        .setOffset({
            right: this._xScale(bisectedData) + this._margin.left + 30,
            left: 0
        });
    /*
     * Update circles.
     */
    var circles = this._canvas.selectAll('circle.data-point')
        .data(tooltipData, function (d) {
            return d.value;
            // return d.category + d.date;
        });
    /*
     * Remove old circles.
     */
    circles.exit().remove();
    /*
     * Render new circles.
     */
    circles.enter()
        .append('circle')
        .attr('class', 'data-point')
        .attr('r', function (d) {
            return d.value ? 5 : 0;
        }).attr('cx', function (d) {
            return d.date ? self._xScale(d.date) : 0;
        }).attr('cy', function (d) {
            return d.value ? self._yScale(d.value) : 0;
        }).style('fill', function (d, i) {
            return self._colors[i];
        });
    /*
     * Update tooltip content.
     */
    this._tooltip.setContent(
            '<div class="default-tooltip-content">' +
            '<ul class="line-graph-list">' +
            tooltipData.reduce(function (html, d, i) {
                return html +=
                    '<li class="legend-list-item">' +
                    '<div class="line-graph-item-container">' +
                    '<span style="background-color: ' + self._colors[i] + ';" class="item-marker"></span>' +
                    '<span>' + self._labels[i] + '</span><span style="float:right">' + d.value + '</span>' +
                    '</div>' +
                    '</li>';
            }, '') +
            '</ul>' +
            '</div>')
        .show();

    /*
     * Update tooltip content.
     */
    if (this._options.groupBy_isDate) {    
        this._xAxisHighlight.setContent(
                '<div class="default-tooltip-content" id="default-tooltip-content-date" style="font-weight: bold;">' +
                moment(bisectedData, moment.ISO_8601).format(this._options.outputInFormat) +
                '</div>')
            .show();
    } else {
        this._xAxisHighlight.setContent(
                '<div class="default-tooltip-content" id="default-tooltip-content-date" style="font-weight: bold;">' + bisectedData + '</div>')
            .show();
    }

    var element = document.getElementById('default-tooltip-content-date');

    clickFunction = function() {
        if (self._options.redirectBaseUrl && self._options.groupBy_isDate) {

            var index = self._bisect(self._dataDomain, date.getTime());
            date = new Date(self._dataDomain[index]);

            window.location.href = self._options.redirectBaseUrl +
                moment(date, moment.ISO_8601).format(self._options.outputInFormat);
        }
        // TODO: add redirect mapping for non date group by
    };
    element.onclick = clickFunction;

};


/**
 * Resize chart.
 * @public
 * @returns {linechart.viewport}
 */
linechart.viewport.prototype.resize = function () {
    /*
     * Get container dimensions.
     */
    var dimension = this._container.node().getBoundingClientRect();
    /*
     * Set up chart outer and inner width and height.
     */
    this._outerWidth = dimension.width;
    this._innerWidth = this._outerWidth - this._margin.left - this._margin.right;
    this._outerHeight = dimension.height;
    this._innerHeight = this._outerHeight - this._margin.top - this._margin.bottom;
    /*
     * Recalculate inner width and shift canvas again.
     * This is necessary if in code above (mobile check) was changes.
     */
    this._canvas.attr('transform', 'translate(' + this._margin.left + ', ' + this._margin.top + ')');
    this._innerWidth = this._outerWidth - this._margin.left - this._margin.right;
    /*
     * Resize mouse events catcher.
     */
    if (this._innerWidth > 0 && this._innerHeight > 0) {
        this._receiver.attr('width', this._innerWidth)
            .attr('height', this._innerHeight + 25);
    }
    /*
     * Configure scale functions.
     */
    this._xScale.range([0, this._innerWidth]);
    this._yScale.range([this._innerHeight, 0]);
    /*
     * Append SVG element.
     */
    this._svg.attr('width', this._outerWidth)
        .attr('height', this._outerHeight);
    /*
     * Update grid.
     */
    this._yAxis.tickSize(-this._innerWidth, 0);
    /*
     * Move x axis corresponding with chart height.
     */
    this._xAxisContainer.attr('transform', 'translate(0, ' + this._innerHeight + ')');

    return this;
};


linechart.viewport.prototype._getDomain = function (data) {
    var options = this._options
    return _.uniq(data.reduce(function (dates, dataSet) {
        return dates.concat(dataSet.map(function (d) {
            //because d.date is a string, it needs to be converted into a new date object
            if (options.groupBy_isDate) {            
                var newDate = new Date(d.date);
                return newDate.getTime();
            } else {
                return d.date;
            }
        }));
    }, [])).sort(function (a, b) {
        return a - b;
    });
};


/**
 * Update chart.
 * @public
 * @param {Object[]} [data]
 * @returns {linechart.chart}
 */
linechart.viewport.prototype.update = function (data) {
    /*
     * Use current data if not provided.
     */
    if (data) {
        this._data = data;
    } else {
        data = this._data;
    }
    /*
     * Get all possible date values and sort them for future bisect function.
     */
    this._dataDomain = this._getDomain(data);
    /*
     * Stash reference to this object.
     */
    var self = this;
    /*
     * Get x extent.
     */
    this._xDomain = this._getXDomain(data);
    /*
     * Get y extent.
     */
    this._yDomain = this._getYDomain();
    /*
     * Update scale functions.
     */
    this._xScale.domain(this._xDomain);
    this._yScale.domain(this._yDomain);
    /*
     * Evaluate amount of required ticks to display only years.
     */
    var datesDomainLength = this._dataDomain.length;
    var xScaleTicksAmount = Math.max(this._innerWidth / 80, 2); // this._xScale.ticks().length;
    var ticksAmount = Math.min(datesDomainLength, xScaleTicksAmount);
    /*
     * Update chart axes.
     */
    this._xAxisContainer.call(this._xAxis.ticks(ticksAmount));
    this._yAxisContainer.call(this._yAxis);
    /*
     * Update series.
     */
    this._series.data(data);
    /*
     * Update and move lines.
     */
    this._lines.data(data)
        .attr('d', this._lineGenerator);

    return this;
};
