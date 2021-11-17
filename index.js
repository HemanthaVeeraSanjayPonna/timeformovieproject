
require('dotenv').config();
const express =require("express");
const app=express();
const bodyParser=require("body-parser");
const ejs =require("ejs");
const mongoose=require('mongoose');
const encryption=require('mongoose-encryption');
const session = require('express-session');
const passport=require('passport');
const passportLocalMongoose=require('passport-local-mongoose');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const TwitterStrategy = require('passport-twitter').Strategy;
const findOrCreate = require('mongoose-find-or-create');


app.set("view engine","ejs");
app.use(bodyParser.urlencoded({extended:true}));
app.use(express.static("public"));

app.use(session({
  secret: process.env.SECRET,
  resave: false,
  saveUninitialized: false
}));
mongoose.connect('mongodb+srv://usrName:pass@cluster0-odgfs.mongodb.net/ticketsDB',{useNewUrlParser:true, useUnifiedTopology: true});
mongoose.set('useCreateIndex', true);
mongoose.set('useFindAndModify', false);
app.use(passport.initialize());
app.use(passport.session());
// const saltRounds = 10;
const userSchema=new mongoose.Schema({
  username:String,
  password:String,
  googleId:String,
  fullName:String,
  facebookId:String,
  reserved:Array,
  booked:Array,
  twitterId:String
});
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const users=new mongoose.model('user',userSchema);

passport.use(users.createStrategy());

passport.serializeUser(function(users, done) {
  done(null, users.id);
});

passport.deserializeUser(function(id, done) {
  users.findById(id, function(err, users) {
    done(err, users);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "https://timeformovie.herokuapp.com/auth/google/tickets"
  },
  function(accessToken, refreshToken, profile, cb) {
    //console.log(profile);
    users.findOrCreate({ googleId: profile.id,fullName:profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));


passport.use(new FacebookStrategy({
    clientID: process.env.APP_ID,
    clientSecret: process.env.APP_SECRET,
    callbackURL: "https://timeformovie.herokuapp.com/auth/facebook/tickets"
  },
  function(accessToken, refreshToken, profile, cb) {
  //  console.log(profile);
    users.findOrCreate({ facebookId: profile.id,fullName:profile.displayName }, function (err, user) {
      return cb(err, user);
    });
  }
));


passport.use(new TwitterStrategy({
    consumerKey: process.env.TWITTER_CONSUMER_KEY,
    consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
    callbackURL: "https://timeformovie.herokuapp.com/auth/twitter/tickets"
  },
  function(token, tokenSecret, profile, done) {
    //console.log(profile);
    users.findOrCreate({twitterId:profile.id,fullName:profile.displayName}, function(err, user) {
      if (err) { return done(err); }
      done(null, user);
    });
  }
));





const ticketsSchema=new mongoose.Schema({
  ticketsAll:Array
});
const tickets=new mongoose.model('ticket',ticketsSchema);

//old array all seats logic
var arr=[];
var ticketPriceFixed=100;
var maxSeats=100;
function seats(seatnum,book,reser){
  this.seatnumber=seatnum;
  this.booked=book;
  this.reserved=reser;
}
for(var i=0;i<maxSeats;i++){
  var s=new seats(i+1,false,false);
  arr.push(s);
}
//sending all seats old logic to common tickets collection in DB



//var loggedStatusSet = false;

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile'] })
);


app.get('/auth/google/tickets',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/profile');
  });



  app.get('/auth/facebook',
    passport.authenticate('facebook'));

  app.get('/auth/facebook/tickets',
    passport.authenticate('facebook', { failureRedirect: '/login' }),
    function(req, res) {
      // Successful authentication, redirect home.
      res.redirect('/profile');
    });


    app.get('/auth/twitter', passport.authenticate('twitter'));
    app.get('/auth/twitter/tickets',
      passport.authenticate('twitter', { successRedirect: '/profile',
                                         failureRedirect: '/login' }));



app.get("/booking",function(req,res){
  if(req.isAuthenticated()){
  //  loggedStatusSet=true;
    tickets.findOne(function(err,docs){
      if(err){
        console.log(err);
      }else{
        res.render("bookingPage",{booking:docs.ticketsAll,logged:((req.isAuthenticated())?true:false)});
      }
    });
  }else{
    res.redirect("/login");
  }

})

app.get("/",function(req,res){
  res.render("homepage",{logged:((req.isAuthenticated())?true:false)});
  tickets.countDocuments({},function(err,result){
    if(err){
      console.log(err);
    }else{
      if(result>=1){

      }else{
        console.log("added one");
        var tic =new tickets({ticketsAll:arr});
        tic.save();
      }
    }
  })

})
app.get("/login",function(req,res){
  if(req.isAuthenticated()){
    res.redirect("/");
  }else{
    res.render("login",{logged:((req.isAuthenticated())?true:false)});
  }
})
app.get("/register",function(req,res){
  if(req.isAuthenticated()){
    res.redirect("/");
  }else{
    res.render("register",{logged:((req.isAuthenticated())?true:false)});
  }

})
app.get("/profile",function(req,res){
  if(req.isAuthenticated()){
  //  loggedStatusSet=true;
    users.findOne({_id:req.user.id},function(err,doc){
      //console.log(doc);
     if(err){
       console.log(err);
     }else{
       res.render("profile",{logged:((req.isAuthenticated())?true:false),reserv:doc.reserved,book:doc.booked,namee:req.user.fullName});
     }
    })
}else{
  res.redirect("/");
}
})

app.get('/about',function(req,res){
  res.render('about',{logged:((req.isAuthenticated())?true:false)});
})

app.get('/logout', function(req, res){
  //loggedStatusSet=false;
  req.logout();
  res.redirect('/');
});
app.post("/booking",function(req,res){
 let u=req.body.checked;
 let sel=[];
if(typeof u=="string"){
  sel.push(u);
}else if(typeof u=="object"){
  u.forEach(function(o){
    sel.push(o);
  })
}
//console.log(sel);
let submittingUserId=req.user.id;
//console.log(req.user.id);
sel.forEach(function(l){
tickets.findOne(function(err,docs){
    if(err){
      console.log(err);
      res.redirect("/booking");
    }else{
      if(docs.ticketsAll[l-1].reserved==true){
        console.log("fake attempt");
      }else{
        tickets.updateOne({'ticketsAll.seatnumber':docs.ticketsAll[l-1].seatnumber}, {'$set': {'ticketsAll.$.reserved':true,}}, function(err){
          if(err){
            console.log(err);
          }else{

          }
        })
        //console.log("jjj");
        users.findOne({_id:submittingUserId},function(err,doc){
              if(err){
                console.log(err);
              }else{
                doc.reserved.push(docs.ticketsAll[l-1].seatnumber);
                doc.save();
                console.log(doc);
              }
        })
      }
    }
  })
})

if(u==0||u==null){
  sel.splice(0,sel.length);
  res.redirect("/booking");
}else{
setTimeout(function(){
res.redirect("/profile");
},2000);

setTimeout(function(){
users.findOne({_id:submittingUserId},function(err,doc){
if(err){
  sel.splice(0,sel.length);
  console.log(err);
}else{
if(doc.reserved.length>0){
  var s=doc.reserved;

  s.forEach(function(i){
    tickets.updateOne({'ticketsAll.seatnumber':i}, {'$set':{'ticketsAll.$.reserved':false}}, function(err){
      if(err){
        console.log(err);
      }else{
     console.log("success");
      }
    })
  })
  doc.reserved.splice(0,doc.reserved.length);
  doc.save();
}
  sel.splice(0,sel.length);
}
})
},100000);



  // u=0;
  // let payArr=[];
  // let ticketPrice=[];
  // if(typeof u=="string"){
  //     ticketPrice.push({seat:u,price:ticketPriceFixed});
  // }else if(typeof u=="object"){
  // u.forEach(function(i){
  //     ticketPrice.push({seat:i,price:ticketPriceFixed});
  // })
  // }
  //     res.render("payment",{tickets:ticketPrice});






  // setTimeout(function(){
  //   console.log("timer called");
  //   let verifyAfterSometime=ticketPrice;
  //   verifyAfterSometime.forEach(function(m){
  //     console.log("goes to for each loop");
  //     if(arr[m.seat-1].booked==false){
  //       console.log("reserved false called");
  //       arr[m.seat-1].reserved=false;
  //       arr[m.seat-1].booked=false;
  //     }
  //   })
  // },10000);

}
})

app.get("/payment",function(req,res){
  if(req.isAuthenticated()){
    users.findOne({_id:req.user.id},function(err,doc){
      if(err){
        console.log(err);
      }else{
        if(doc.reserved.length==0){
          res.redirect("/booking");
        }else{
       let userSelectedSeats=doc.reserved;
      let ticketPrice=[];
       ticketPrice.push({seat:userSelectedSeats,price:ticketPriceFixed*(userSelectedSeats.length)});
       res.render("payment",{tickets:ticketPrice});
       ticketPrice.splice(0,ticketPrice.length);
     }
      }
    })
  }else{
    res.redirect("/");
  }
})
app.post('/register', function(req, res) {
  users.register(new users({ username : req.body.username, fullName:req.body.name }),req.body.password,function(err, account) {
      if (err) {
        console.log(err);
       res.send('<center><br><br><h1>User already exists, Please </h1><a href="/login">LOGIN</a></center>')
      }else{
        console.log(account);
      passport.authenticate('local')(req, res, function () {
      //  loggedStatusSet=true;
        res.redirect('/');

      });
    }
  });
});

app.post('/login',passport.authenticate('local'),function(req,res){
  res.redirect('/booking');
})



app.post("/payment",function(req,res){
if(req.isAuthenticated()){
  let userEnteredAmount=req.body.amountUser;
    users.findOne({_id:req.user.id},function(err,doc){
      if(err){
        console.log(err);
      }else{
        //console.log(doc);
        if((doc.reserved.length*ticketPriceFixed)==userEnteredAmount){
          for (var i of doc.reserved) {
             doc.booked.push(i);
            }
        //  doc.booked=doc.reserved;
          let s=doc.booked;
          doc.reserved.splice(0,doc.reserved.length);
          doc.save();
          s.forEach(function(i){
            tickets.updateOne({'ticketsAll.seatnumber':i}, {'$set': {'ticketsAll.$.booked':true,}}, function(err){
              if(err){
                console.log(err);
              }else{
             console.log("success");
              }
            })
          })
     res.send("<center><br><br><h1>Payment Successful</h1><br><br><br><a href='/profile'>Profile</a></center>")
        }else{
             res.send("<center><br><br><h1>Payment Failed!!!</h1><br><br><br><a href='/'>Home</a></center>")
        }
      }
    });
}else{
  res.redirect("/");
}

//   let receivedSeats=req.body.seatss;
//   let paySeats=[];
//   console.log(typeof receivedSeats);
//     console.log(receivedSeats);
//     if(typeof receivedSeats=="object"){
//         receivedSeats.forEach(function(i){
//           paySeats.push(i);
//         })
//     }else if(typeof receivedSeats=="string"){
//         paySeats.push(receivedSeats);
//     }
//   console.log(req.body.pricee);
//
// if(userEnteredAmount==req.body.pricee){
//    paySeats.forEach(function(u){
//        arr[u-1].booked=true;
//        arr[u-1].reserved=true;
//    });
//    paySeats.splice(0,paySeats.length);
// res.send("<center><h1>SUCCESS!!!</h1><br><br><br><a href='/booking'>BOOKING PAGE</a></center>")
// }else{
//   paySeats.splice(0,paySeats.length);
// res.send("<center><h1>FAIL!!!</h1><br><br><br><a href='/booking'>BOOKING PAGE</a></center>")
//
// }

});



app.listen(process.env.PORT||3000,function(req,res){
  console.log("server has started at port 3000");
});
