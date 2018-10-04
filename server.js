const express  = require('express');
const app      = express();
const mongoose = require('mongoose');
const request = require('request');
const bodyParser = require('body-parser');

const getCarparkInfo = {
    url: 'http://datamall2.mytransport.sg/ltaodataservice/CarParkAvailabilityv2',
    headers: {
        "AccountKey":"uLsa/Y6DQCiMMhrxe+YFPw=="
    }
}

mongoose.connect('mongodb://localhost:27017/carpark', {useCreateIndex: true});

//Create Database Schema and Model
const carparkSchema = mongoose.Schema({
    carParkID: String,
    area: String,
    development: String,
    location:{type: { type: String },coordinates: []},
    availableLots: Number,
    lotType: String,
    agency: String
})
carparkSchema.index({ location: "2dsphere" });
const CarparkData= mongoose.model('CarparkData',carparkSchema);

//Get Carpark data from datamall
setImmediate(()=>{
    request(getCarparkInfo, (err,res,body)=>{
        var info = JSON.parse(body);
        for (i = 0; i < info.value.length; i++){
            var caraprkRecord=new CarparkData({
                carParkID : info.value[i].CarParkID,
                area: info.value[i].Area,
                development: info.value[i].Development,
                location:{type:"Point",coordinates: 
                    [parseFloat(info.value[i].Location.split(' ')[1]),
                    parseFloat(info.value[i].Location.split(' ')[0])]},
                availableLots: info.value[i].AvailableLots,
                lotType: info.value[i].LotType,
                agency: info.value[i].Agency
            });
            caraprkRecord.save();
        }
        console.log("Database Loading Complete.");
    });

})

//Update Carpark Avaliable lots with interval 5min

setInterval(()=>{
    request(getCarparkInfo, (err,res,body)=>{
        var info = JSON.parse(body);
        for (i = 0; i < info.value.length; i++){
            var query = {'carParkID':info.value[i].CarParkID};
            var newAvailableLots = info.value[i].AvailableLots;
            CarparkData.updateOne(query, {availableLots : newAvailableLots}, function(err,doc){
                if (err) return console.log(500, { error: err });
            });
        }
    });
    console.log('Database Update Complete!');
}, 300000);

//API for getting specific carpark with ID
app.get('/get-id/:id',(req,res)=>{
    CarparkData.find({carParkID: req.params.id},(err,docs)=>{
        if(err) res.json(docs);
        else res.send(docs);
    })
})

//Get Lon and Lan and find the carpark in 1000m.
app.get('/get-carpark/:currentLatitude/:currentLongitude',(req,res)=>{
    CarparkData.find({
            location: {
                $near: {
                    $maxDistance: 1000,
                    $geometry:{ 
                        type: "Point", 
                        coordinates: [req.params.currentLongitude,req.params.currentLatitude]
                    }
                }
            }
        },(err, docs) => {
            if (err) console.log(err);
            else res.send(docs);
        });
});

const port = process.env.port || 3000;
app.listen(port,()=>console.log(`Listen on port ${port}...`));