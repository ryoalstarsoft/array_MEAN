var User = require('../../../models/users');

var Recurly = require('node-recurly');
var recurlyConfig = {
    API_KEY: process.env.RECURLY_API_KEY ? process.env.RECURLY_API_KEY : null,
    SUBDOMAIN: process.env.RECURLY_SUBDOMAIN ? process.env.RECURLY_SUBDOMAIN : 'schema',
    DEBUG: process.env.RECURLY_DEBUG ? process.env.RECURLY_DEBUG : false
};
var recurly = new Recurly(recurlyConfig);


module.exports.getAll = function(req, res) {

    var userId = req.user._id;

    User.findById(userId)
        .populate('_team')
        .populate('defaultLoginTeam')
        .exec(function(err, user) {
            if (err) {
                res.status(500).send(err);
            } else {

                if (!user.defaultLoginTeam || user._team.length === 0) {
                    return res.status(401).send({ error: 'unauthorized' });
                }

                if (!user.isSuperAdmin() && !user.defaultLoginTeam.admin && user.defaultLoginTeam.admin != userId) {
                    return res.status(401).send({ error: 'unauthorized' });
                }

                recurly.adjustments.list(user.defaultLoginTeam._id.toString(), function(err, response) {
                    if (err) {
                        res.status(err.statusCode).send(err);
                    } else {
                        res.status(response.statusCode).json(response);
                    }
                });
            }
        });
};
