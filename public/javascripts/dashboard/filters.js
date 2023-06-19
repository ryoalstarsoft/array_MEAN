var app = angular.module('arraysApp');

app.filter('dotless', function () {
    return function (input) {
        if (input) {
            return input.replace(/\./g, '_');
        }
    };
});
app.filter('isSuperAdmin', function() {
    return function(user) {
        if (user) {
            return (user.email.indexOf('schemadesign.com') >= 0 || user.email.indexOf('arrays.co') >= 0)
        }
    }
})

app.filter('datasourceUIDFromTitle',function() {
    return function(title) {
        return title.toLowerCase().replace(/[^A-Z0-9]+/ig, "_")
    }
})


app.filter('capitalize', function () {
    return function (input) {
        if (input != null)
            input = input.toLowerCase();
        return input.substring(0, 1).toUpperCase() + input.substring(1);
    };
});

app.filter('appendPluralized', function () {
    return function (input, singular, plural) {
        input = parseInt(input);
        if (input === undefined) {
            return;
        }
        else if (input === 0) {
            return 'No ' + input + ' ' + plural;
        }
        else if (input === 1) {
            return input + ' ' + singular;
        }
        else {
            return input + ' ' + plural;
        }
    };
});

app.filter('pluralize', function () {
    return function (input, singular, plural) {
        if (input === undefined) {
            return;
        }
        else if (input === 0) {
            return 'No ' + plural;
        }
        else if (input === 1) {
            return singular;
        }
        else {
            return plural;
        }
    };
});



app.filter('typeCoercionToString', function () {

    return function (input,inferredType) {
        var data_type = (input)? input.operation: inferredType;
       
        // if (opName == 'ProxyExisting') {
            // return 'Proxy';
        if (data_type == 'ToDate') {
            return 'Date';
        } else if (data_type == 'ToInteger') {
            // return 'Integer';
            return 'Number';
        } else if (data_type == 'ToFloat') {
            // return 'Float';
            return 'Number';
        // } else if (opName == 'ToStringTrim') {
        //     return 'String Trim';
        } else {

            return 'Text'; // 'Unknown'

        }
    };
});

app.filter('viewToName',function() {
    return function(input) {
        return input.split(/(?=[A-Z])/).join('-').toLowerCase();
    };
});

app.filter('jobTask', function() {
    return function(input) {
        if (input == 'preImport') {
            return 'Import Raw Objects';
        } else if (input == 'importProcessed') {
            return 'Import Processed Objects';
        } else if (input == 'postImport') {
            return 'Caching unique filters';
        } else if (input == 'scrapeImages') {
            return 'Image Scraping';
        }
    };
});

app.filter('omit',function() {
    return function(input,keyName) {
        var copy = angular.copy(input);
        delete copy[keyName];
        return copy;
    };
});
