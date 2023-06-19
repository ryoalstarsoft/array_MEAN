$(window).load(function () {

    if (mixpanel) {
        trackEvent("page load");

        trackEvent('page viewed', {
            'page name': document.title,
            'url': window.location.pathname
        });


    }

    /**
     * Add class to body to prevent weird page width transitions
     */
    $('body').addClass('app-ready');
});

$(document).ready(function () {

    setOriginalTextAttribute('.explore-tile-header h2');
    var isWebkit = 'WebkitAppearance' in document.documentElement.style

    /**
     * Truncate vis title if not webkit browser
     */
    if (!isWebkit) {
        loopThroughTileElement('.explore-tile-header h2', 28);
        $(window).on('resize', function() {
            loopThroughTileElement('.explore-tile-header h2', 28);
        })
    }

    /**
     * Select source dataset on click
     */
    $('.js-panel-array').on('click', function (e) {
        e.preventDefault();



        var $parent = $(this).parent();

        var default_view = $parent.find("[name='default_view']").val();
        if (default_view === undefined || default_view == 'undefined' || default_view == '') {
            default_view = 'gallery';
        }

        var default_filterJSON = $parent.find("[name='default_filterJSON']").val();

        var sourceKey = $parent.find("[name='source_key']").val();
        var baseUrl = $parent.find("[name='subdomainUrl']").val();

        if (typeof baseUrl == 'undefined') {
            baseUrl = "";
        }

        //toDo: get view from api

        var viewTypes = ['gallery', 'pie-chart', 'line-graph', 'scatterplot', 'map', 'timeline', 'word-cloud', 'bar-chart', 'pie-set', 'globe'];

        var words = default_view.split(/(?=[A-Z])/);
        var default_view_url = words.map(function (word) {
            return word.toLowerCase();
        }).join('-');



        if (viewTypes.indexOf(default_view_url) < 0) { //custom view
            href = '/' +  sourceKey;
        } else {
            href = '/' + sourceKey + '/' + default_view_url;
            if (default_filterJSON !== '' && default_filterJSON !== null && typeof default_filterJSON !== 'undefined') {
                href += "?" + default_filterJSON;
            }
         }
        var viewTab = window.open(baseUrl + href, '_blank');
        viewTab.focus();
    });

    /**
     * Select team on click
     */
    $('.js-panel-team').on('click', function (e) {

        e.preventDefault();
        var $parent = $(this).parent();
        var subdomain = $parent.find("[name='subdomain']").val();
        window.location.href = subdomain;

    });

    /**
     * Allow click on source dataset URL within the panel
     */
    $('.source-link').on('click', function (e) {
        e.stopPropagation();
    });

    /**
     * Allow click on team dataset URL within the panel
     */
    $('.team-link').on('click', function (e) {
        e.stopPropagation();
    });

    /**
     * Show sidebar filter on header bar click
     */
    $('.sidebar-filter-slide-toggle').click(function (e) {
        e.preventDefault();
        $(this).parents('li').toggleClass('active');
        $('body').toggleClass('sidebar-filter-in');
    });

    /**
     * Stop sidebar child events from bubbling up and causing content width bug
     */
    $('.sidebar-filter-subgroup').on('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function (e) {
        e.stopPropagation();
    });

    /**
     * Resize content width after sidebar slide out animation complete
     */
    $('.sidebar-filter').on('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function (e) {
        console.log('slide out complete');
        $('body').toggleClass('sidebar-filter-complete');
        $('body').hide().show(0);
    });

    /**
     * Sidebar filter accordion using Bootstrap
     */
    $('.collapse-trigger').on('click', function (e) {
        e.preventDefault();
        $(this).parent('li').siblings().find('.collapse').collapse('hide');
        $(this).parent('li').find('.collapse').collapse('toggle');
    });

    /**
     * Search criteria click dropdown item to select
     */
    var searchInputPlaceholder = $('.search-input').attr('placeholder');
    var searchWidth;
    if (searchInputPlaceholder != undefined) searchWidth = searchInputPlaceholder.length * 9;
    else searchWidth = 9;
    $('.search-input')
        .css('width', searchWidth + 'px');


    $('.search-dropdown-item a').on('click', function (e) {
        e.preventDefault();
        var colname = $(this).data('colname');
        var newPlaceholder = 'Search by ' + colname;

        $('.search-criteria').html(colname);
        $('.search-colname').attr('value', colname);

        $('.search-input')
            .attr('placeholder', newPlaceholder);
        $('.search-input')
            .css('width', (newPlaceholder.length * 9) + 'px') ;

        $('.search-control .dropdown-toggle').attr('aria-expanded', 'false');
        $(this).closest('.dropdown').removeClass('open');
    });

    /**
     * Mobile search popover
     */
    $('.search-toggle').on('click', function (e) {
        e.preventDefault();
        $(this).toggleClass('search-active');
        $('.mobile-search-popover').toggleClass('search-open');
    });

    /**
     * Popup modal on embed code click
     */
    $('.share-link').on('click', function (e) {
        e.preventDefault();
        _POST_toGetURLForSharingCurrentPage(function (err, share_url) {
            if (err) {
                console.log(err);
            } else {
                $('#modal')
                    .on('show.bs.modal', function (e) {
                        var $modalTitle = $(this).find('.modal-title');
                        var $modalBody = $(this).find('.modal-body');

                        var $arrayTitle = $('.array-title');
                        var arrayTitle = '';
                        if ($arrayTitle.length) {
                            arrayTitle = $('.array-title').html();
                        }

                        $modalTitle.html('Share ' + arrayTitle);
                        $modalBody.html('<h3>Share on Social Media</h3>');
                        $modalBody.append('<div id="facebook" data-url="' + share_url + '" data-text="Arrays"></div>');
                        $modalBody.append('<a href="#" id="twitter" class="btn btn-social background-color-brand" data-url="' + share_url + '" data-text="Arrays"><span class="icon-twitter" aria-hidden="true"></span>Twitter</a>');

                        $modalBody.append('<h3>Share URL</h3>');
                        $modalBody.append('<pre class="border-color-brand">' + share_url + '</pre>');

                        var embedUrl = '<iframe src="' + share_url + '?embed=true" width="640" height="480" frameborder="0"></iframe>';

                        $modalBody.append('<h3>Embed URL</h3>');
                        $modalBody.append('<pre id="embed-url" class="border-color-brand"></pre>');

                        $modalBody.append('<h3><input type="checkbox" id="cbEmbed">  Show header and footer</h3>');
                        $('#embed-url').text(embedUrl);

                        $(this).find('#cbEmbed').change(function () {
                            embedUrl = '<iframe src="' + share_url;
                            if (!$(this).is(":checked")) embedUrl += '?embed=true';
                            embedUrl += '" width="640" height="480" frameborder="0"></iframe>';
                            $('#embed-url').text(embedUrl);
                        });
                        /**
                         * Initialize Sharrre buttons
                         */
                        $(this).find('#twitter').sharrre({
                            share: {
                                twitter: true,
                            },
                            template: '<a href="#" class="btn btn-social background-color-brand"><span class="icon-twitter" aria-hidden="true"></span>Twitter</a>',
                            enableHover: false,
                            buttons: {twitter: {via: 'arrays'}},
                            click: function (api, options) {
                                api.openPopup('twitter');
                            }
                        });

                        $(this).find('#facebook').sharrre({
                            share: {
                                facebook: true,
                            },
                            template: '<a href="#" class="btn btn-social background-color-brand"><span class="icon-facebook" aria-hidden="true"></span>Facebook</a>',
                            enableHover: false,
                            click: function (api, options) {
                                api.openPopup('facebook');
                            }
                        });
                    })
                    .modal();
            }
        });

        return false;
    });

    /**
     * For back links with no referer, do a browser "back"
     */
    $('.browser-back-on-click').on('click', function (e) {
        e.preventDefault();
        window.history.back();

        return false;
    });

    /**
     * Missing image fallback
     */
        // Small
    $('.gallery-image, .timeline-image').error(function () {

        var isScrapedImage = $(this).attr('scraped');

        if (isScrapedImage == 'true') { //replace with alternative link
             var $parent = $(this).parent();
            var actualImageLink = $parent.find("[name='alternativeImgLink']").val();
            $(this).attr('src', actualImageLink);
            $(this).attr('scraped','false');


        } else { //replace with image not found
            $(this).attr('src', '/images/image-not-found-sm.png');
        }

    });

    // Large

    $('.object-featured').error(function () {

        var isScrapedImage = $(this).attr('scraped');

        if (isScrapedImage == 'true') { //replace with alternative link
             var $parent = $(this).parent();
            var actualImageLink = $parent.find("[name='alternativeImgLink']").val();
            $(this).attr('src', actualImageLink);
            $(this).attr('scraped','false');


        } else { //replace with image not found
            $(this).attr('src', '/images/image-not-found-lg.png');
        }
    });

    /**
     * Array description expand/collapse text
     */
    $('.array-description-expand').on('click', function (e) {

        $('.array-description').css("display", "none");
        $('.array-description-full').css("display", "inline");
        $('.array-description-expand').css("display", "none");
        $('.array-description-collapse').css("display", "inline");
    });

    $('.array-description-collapse').on('click', function (e) {
        $('.array-description').css("display", "inline");
        $('.array-description-full').css("display", "none");
        $('.array-description-collapse').css("display", "none");
        $('.array-description-expand').css("display", "inline-block");
    });

    $('#login').on('click', function (e) {
        e.preventDefault();
        window.location.href = '/auth/login';

    });

    $('#forget-pw').on('click',function(e) {

    })



    $('a#logout').on('click',function(e) {

        e.preventDefault();
        $.get('/auth/logout')
        .then(function(response) {


            if (response == 'ok') {

                window.sessionStorage.removeItem('user');
                window.sessionStorage.removeItem('team');
                window.sessionStorage.removeItem('teams');
                window.location.reload();

            }

        })
    })




    $('#revealPassword').change(function(e) {
        if($(this).is(":checked")) {
            $('#passwordInput').attr('type','text');
        } else {
            $('#passwordInput').attr('type','password');

        }
    })

    /**
     * Toggle legend
     */
    $('.legend-toggle').on('click', function(e) {
        e.preventDefault();
        $('body').toggleClass('legend-open');
    });

    /**
     * Close legend
     */
    $('.legend-close').on('click', function(e) {
        e.preventDefault();
        $('body').removeClass('legend-open');
    });

});




/**
 * Construct filter object
 * Analog of nunjucks filter constructedFilterObj() in app.js:63
 */
function constructedFilterObj(existing_filterObj, this_filterCol, this_filterVal, isThisAnActiveFilter) {
    var filterObj = existing_filterObj;
    if (Array.isArray(this_filterCol)) {
        for(var i = 0; i < this_filterCol.length; i++) {
            if(existing_filterObj.hasOwnProperty(this_filterCol[i])) {
                continue;
            } else {
                //since this is currently only for the pie set, it's guaranteed that if this is an array, the filter values will also be an array whose indices match up to the indices of the cols
                filterObj[this_filterCol[i]] = this_filterVal[i];
            }
        }

    } else {
        //
        if (isThisAnActiveFilter === false) { // do not push if active, since we'd want the effect of unsetting it
            filterVals = filterObj[this_filterCol] || [];
            if (Array.isArray(this_filterVal) && filterVals.indexOf(this_filterVal) == -1) {
                for(var i = 0; i < this_filterVal.length; i++) {
                    filterVals.push(this_filterVal[i]);
                }
                filterObj[this_filterCol] = filterVals.length == 1 ? filterVals[0] : filterVals;
            } else {
                filterObj[this_filterCol] = this_filterVal;
            }
        }
    }
    //
    return filterObj;
}

/**
Make space for filter
*/
var pageScrolls = $("body").height() > $(window).height();
var filter = document.querySelector('.filter-tag');
var arrayView = window.location.pathname.split("/")[2];
if (filter && !(arrayView == "map" || arrayView == "globe")) {
    document.querySelector('.site-content').style.paddingBottom = "60px";
}
if (!filter) {
    document.querySelector('.site-content').style.paddingBottom = "0px";
}


function convertQueryStringToObject(inputString) {
    if (inputString == '') return {};

    var obj = {};
    var arr = decodeURIComponent(inputString).split('&');

    for (var i = 0; i < arr.length; i++) {
        var bits = arr[i].split('=');
        var key = bits[0];
        var value = bits[1];
        try {
            value = JSON.parse(value);
        } catch (e) {
            value = bits[1];
        }
        if (!obj.hasOwnProperty(key)) {
            obj[key] = value;
        } else if (typeof obj[key] === 'string') {
            obj[key] = [obj[key]];
            obj[key].push(value);
        } else if (Array.isArray(obj[key])) {
            obj[key].push(value);
        }
    }

    return obj;
}

function _POST_toGetURLForSharingCurrentPage(callback) { // callback: (err:Error, share_url:String) -> Void
    var parameters = {
        url: window.location.href
    };

    $.post(window.location.origin + "/v1/share", parameters, function (data) {
        var share_url = data.share_url;
        var err = null;
        if (!share_url) {
            err = new Error('Missing share_url from response.');
        }
        callback(err, share_url);
    }, "json");
}

function trackEvent(eventName, eventPayload) {
    if (typeof eventPayload === 'undefined' || eventPayload === null) {
        eventPayload = {};
    }
    var basePayload = {source: "client"}; // this lets us identify the source vs the server
    eventPayload = $.extend(basePayload, eventPayload);
    mixpanel.track(eventName, eventPayload);
}

function setOriginalTextAttribute(element) {
    $(element).each(function (index, currentElement) {
        $(currentElement).attr("originalText", currentElement.innerText);
    })
}

function loopThroughTileElement(element, fontSize) {
    var containerWidth = $('.explore-tile-header').width();
    $(element).each(function (index, currentElement) {
        var text = $(currentElement).attr("originalText");
        currentElement.innerText = truncate(containerWidth, text, fontSize);

    })
}

function truncate(containerWidth, text, fontSize) {
    // // font size is 28 px
    // // max number of lines is 2
    // // so if the length of the title * 28 > the width of the explore tile container * 2, it needs to be truncated
    var textSize = fontSize * text.length;
    var containerMax = containerWidth * 2;

    if (textSize/2 > containerMax) {
        var difference = parseInt((textSize - containerMax)/fontSize);
        var maxLength = (text.length - 3 - difference) * 2;
        // console.log(maxLength)
        // remove the difference from the end of the string
        truncatedText = text.substring(0, maxLength);
        truncatedText += "...";
        return truncatedText
    }
    return text;

}