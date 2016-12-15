// PaymentDetailsInfo.route.js
var express = require('express');
var router = express.Router();

// api route

var userData = {
    'first_name': 'John',
    'last_name': 'John',
    'userType': '1',
    'address': {
        'street': 'abc sd ds dsd',
        'city': 'Austin',
        'state': 'CA',
        'country': 'USA'
    }
};

router.route('/getUserDetails')
    .get(function(req, res) {
            res.json(userData);
    });

module.exports = router;
