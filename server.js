var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var mongoose = require('mongoose');
const crypto = require("crypto");
var rp = require('request-promise');



var app = express();
module.exports = app; // for testing
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());


var router = express.Router();

const GA_TRACKING_ID = process.env.GA_KEY;

function trackDimension(category, action, label, value, dimension, metric, metric2) {

    var options = { method: 'GET',
        url: 'https://www.google-analytics.com/collect',
        qs:
            {   // API Version.
                v: '1',
                // Tracking ID / Property ID.
                tid: GA_TRACKING_ID,
                // Random Client Identifier. Ideally, this should be a UUID that
                // is associated with particular user, device, or browser instance.
                cid: crypto.randomBytes(16).toString("hex"),
                // Event hit type.
                t: 'event',
                // Event category.
                ec: category,
                // Event action.
                ea: action,
                // Event label.
                el: label,
                // Event value.
                ev: value,
                // Custom Dimension
                cd1: dimension,
                // Custom Metric
                cm1: metric,
                cm2: metric2
            },
        headers:
            {  'Cache-Control': 'no-cache' } };

    return rp(options);
}



//********************************* MOVIES ROUTING *********************************

router.route('/movies')
    .post(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);

        //check if query was  sent with request

        var createReview;

        if(req.query.reviews === "true"){
            createReview = true;
        }

        //if ?reviews = true I will check if request has required fields

        if (createReview){

            if(!req.body.reviewerName || !req.body.quote || !req.body.rating){
                return res.json({success: false, message: 'Error,  Empty Reviewer Name, rating, and/or Quote fields.'});
            }

        }

        //checking if req has proper key value pairs for movie creation

        if (!req.body.title || !req.body.releaseDate || !req.body.genre) {
            return res.json({success: false, message: 'Error,  Empty fields.'});
        }
        if(!req.body.actors[0] || !req.body.actors[1]|| !req.body.actors[2]){

            return res.json({success: false, message: 'Error,  Less than 3 actors.'});

        }

        //manually creating _id
        var movieID = mongoose.Types.ObjectId();
        //console.log('movieid:'+ movieID);

        //creating and saving movie doc
        Movie.create({ _id: movieID, title: req.body.title, releaseDate: req.body.releaseDate, genre: req.body.genre, actors: req.body.actors}, function (err) {
            if(err){
                console.log('Error Inserting New Data');

                if (err.name == 'ValidationError') {
                    for (field in err.errors) {
                        console.log(err.errors[field].message);
                    }
                }
                // duplicate entry
                if (err.code == 11000)
                    return res.json({success: false, message: 'The movie is not unique. '});
                else
                    return res.send(err);
            }
            else{
                console.log("movie "  + req.body.title  + " saved.");
            }
        });

        //if query reviews = true it will also create a review doc and saves it.
        if(createReview){

            //making review object
            var  review = new Review();
            review.reviewerName = req.body.reviewerName;
            review.quote = req.body.quote;
            review.rating = req.body.rating;


            //getting auth info from JWT token
            const usertoken = req.headers.authorization;
            const token = usertoken.split(' ');
            const decoded = jwt.verify(token[1], process.env.SECRET_KEY);
            console.log(decoded);
            review.username = decoded.username;
            //review.reviewerName = decoded.name;
            review.userId = mongoose.Types.ObjectId( decoded.id);

            //getting movie id from manual creation and assigning to review object
            review.movieId = movieID;


            //saving review doc
            review.save(function(err) {

                if (err) {

                    console.log('Error Inserting New Data');

                    if (err.name == 'ValidationError') {
                        for (field in err.errors) {
                            console.log(err.errors[field].message);
                        }
                    }
                    // duplicate entry
                    if (err.code == 11000)
                        return res.json({success: false, message: 'The Review is not unique. '});
                    else
                        return res.send(err);
                }
                else{
                    return res.json({ success: true, message: 'Movie created and review.' })
                }
            })


        }
        else{

            return res.json({ success: true, message: 'Movie created.' });
        }



    })
    .put(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);

        if (!req.body.title || !req.body.s || !req.body.update) {
            res.json({success: false, message: 'Error,  Empty fields.'});
        }
        var temp = req.body.s;
        const filter = { title: req.body.title };
        console.log(filter);
        var update = req.body.s;
        var args = {};
        args[update] = req.body.update;
        console.log(args);


        Movie.findOneAndUpdate(filter, args, function(err, result) {
            if (err) {
                return res.json({ success: false, message: 'Update error.' })
            }
            else {

                if(result !== null) {
                    return res.json({ success: true, message: 'Movie Updated.' });
                } else {
                    return res.json({ success: false, message: 'Movie not found.' })
                }
            }

        });

    })
    .delete(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);

        if (!req.body.title) {
            res.json({success: false, message: 'Error,  Empty fields.'});
        }


        Movie.findOneAndDelete({'title':req.body.title})
            .then(deletedDocument => {
                if(deletedDocument) {
                    res.json({ success: true, message: 'Movie Deleted.' });
                }
                else {
                    res.json({success: false, message: 'Error,  no matching movie found.'});
                }
            })
            .catch(err => console.error(`Failed to find and delete movie: ${err}`))

    })
    .get(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);

        var getReview;

        if(req.query.reviews === "true"){
            getReview = true;
        }

        Movie.find(function (err, movie) {
        if(err){
            res.send(err);
        }
        else{

            if(getReview){

                Movie.aggregate([
                    {$match:{}},
                    {
                        $lookup:{
                            from: 'reviews',
                            foreignField: 'movieId',
                            localField: '_id',
                            as: 'Reviews'
                        }
                    },
                    {
                        $sort:{

                            rating : -1

                        }
                    }
                ], function (err, output) {
                    if(err){
                        return res.json({ success: false, message: 'Aggregation Error' })
                    }
                    else{
                        res.json(output);
                    }

                })
            }
            else{
                res.json(movie);
            }

        }
        })

    });
//get movies by their id
router.route('/movies/:movieId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);
        console.log("here");

        var getReview;

        if(req.query.reviews === "true"){
            getReview = true;
        }

        var id = req.params.movieId;

        Movie.findById( id, function(err, movie) {
            if (err) res.send(err);
            else{

                if(getReview){

                    Movie.aggregate([
                        {
                            $match: {'_id': mongoose.Types.ObjectId(id)}
                        },
                        {
                            $lookup:{
                                from: 'reviews',
                                foreignField: 'id',
                                localField: 'movieId',
                                as: 'Reviews'
                            }
                        },
                        {
                            $sort:{

                                rating : -1

                            }
                        }
                    ], function (err, output) {
                        if(err){
                            return res.json({ success: false, message: 'Aggregation Error' })
                        }
                        else{
                            res.json(output);
                        }

                    })
                }
                else{

                    if(movie !== null) {
                        return res.json(movie);
                    } else {
                        return res.json({ success: false, message: 'Movie not found.' })
                    }
                }

            }
        });
    });

//********************************* REVIEWS ROUTING *********************************

router.route('/reviews')
    .get(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);

        Review.find(function (err, review) {
            if(err){
                res.send(err);
            }
            else{
                res.json(review);
            }
        })
    })
    .post(authJwtController.isAuthenticated, function(req,res){
        console.log(req.body);

        if( !req.body.reviewerName || !req.body.quote || !req.body.rating || !req.body.movieId){

            return res.json({success: false, message: 'Error,  Empty Reviewer Name, movieId, rating, and/or Quote fields.'});

        }

        Movie.findById(req.body.movieId, function (err, movie) {

            if(err){
                return res.json({success: false, message: 'Error finding movie.'});
            }
            else{
                if(movie === null){
                    return res.json({success: false, message: 'Error, Movie not found.'});
                }
                else{

                    var review = new Review();

                    review.reviewerName = req.body.reviewerName;
                    review.quote = req.body.quote;
                    review.rating = req.body.rating;
                    review.movieId = req.body.movieId;


                    const usertoken = req.headers.authorization;
                    const token = usertoken.split(' ');
                    const decoded = jwt.verify(token[1], process.env.SECRET_KEY);
                    console.log(decoded);
                    review.username = decoded.username;
                    review.userId = mongoose.Types.ObjectId( decoded.id);

                    review.save(function(err) {

                        if (err) {

                            console.log('Error Inserting New Data');

                            if (err.name == 'ValidationError') {
                                for (field in err.errors) {
                                    console.log(err.errors[field].message);
                                }
                            }
                            // duplicate entry
                            if (err.code == 11000)
                                return res.json({success: false, message: 'The Review is not unique. '});
                            else
                                return res.send(err);
                        }
                        else{

                            trackDimension( movie.genre, 'post /reviews', 'API Request for Movie Review', '1', movie.title, '1', '1')
                                .then(function (response) {
                                    console.log(response.body);
                                });

                            return res.json({ success: true, message: 'Review saved.' })
                        }
                    })

                }
            }

        });

    });




//********************************* USERS ROUTING AND AUTH *********************************
router.route('/postjwt')
    .post(authJwtController.isAuthenticated, function (req, res) {
            console.log(req.body);
            res = res.status(200);
            if (req.get('Content-Type')) {
                console.log("Content-Type: " + req.get('Content-Type'));
                res = res.type(req.get('Content-Type'));
            }
            res.send(req.body);
        }
    );

router.route('/users/:userId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var id = req.params.userId;
        User.findById(id, function(err, user) {
            if (err) res.send(err);

            var userJson = JSON.stringify(user);
            // return that user
            res.json(user);
        });
    });

router.route('/users')
    .get(authJwtController.isAuthenticated, function (req, res) {
        User.find(function (err, users) {
            if (err) res.send(err);
            // return the users
            res.json(users);
        });
    });

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, message: 'Please pass username and password.'});
    }
    else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;
        // save the user
        user.save(function(err) {
            if (err) {
                // duplicate entry
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists. '});
                else
                    return res.send(err);
            }

            res.json({ success: true, message: 'User created!' });
        });
    }
});

router.post('/signin', function(req, res) {

    console.log(req.body);

    var userNew = new User();
    //userNew.name = req.body.name;
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) res.send(err);

        try{
            user.comparePassword(userNew.password, function(isMatch){
                if (isMatch) {
                    var userToken = {id: user._id, username: user.username};
                    var token = jwt.sign(userToken, process.env.SECRET_KEY);
                    res.json({success: true, token: 'JWT ' + token});
                }
                else {
                    res.status(401).send({success: false, message: 'Authentication failed.'});
                }
            })
        }
        catch(err){
            res.status(401).send({success: false, message: 'Authentication failed. User not known or ' + err.name}) //user not know  for debugging purposes
        }




    });
});

app.use('/', router);
app.listen(process.env.PORT || 8080);
