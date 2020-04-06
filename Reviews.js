var mongoose = require('mongoose');
var Schema = mongoose.Schema;



mongoose.Promise = global.Promise;

mongoose.connect(process.env.DB, { useNewUrlParser: true } );
mongoose.set('useCreateIndex', true);
mongoose.set('useFindAndModify', false);

// review schema
var ReviewSchema = new Schema({
    reviewerName: { type: String, required: true},
    quote: { type: String, required: true},
    username : { type : String, required: true},
    rating: { type: Number, min: 1, max: 5, required: true },
    userId: {type: mongoose.Schema.Types.ObjectId, required: true},
    movieId: {type: mongoose.Schema.Types.ObjectId, required: true}
});
ReviewSchema.index({userId : 1, movieId :1},{unique: true});

// return the model
module.exports = mongoose.model('Review', ReviewSchema);