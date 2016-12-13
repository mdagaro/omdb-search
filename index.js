const Emitter = require("events");
const prompt = require("prompt");
const request = require("request");
const google = require('google');
const $ = require('jquery');
const fs = require('fs');
var emitter = new Emitter();

emitter.on("prompt-complete", (terms) => {
  movie_regex = /^(.+) \(([\d]{4})\) - IMDb/;
  movie_array = [];
  google.resultsPerPage = 100;
  google("site:www.imdb.com " + terms, function(err,res) {
    if (err) console.error(err);
    for(var i = 0; i < res.links.length; ++i) {
      var link = res.links[i];
      var match = movie_regex.exec(link.title);
      if (match !== null) {
        link.title = match[1];
        link.year = match[2];
        link.id = link.link.substring(26,35);
        movie_array.push(link);
      }
    }
    emitter.emit("search-complete",movie_array);
  });
});

emitter.on("search-complete", (movie_array) => {
  if (movie_array.length !== 0) {
    console.log("What movies do you want?");
    for(var i = 0; i < movie_array.length; ++i) {
      console.log(i + ". " + movie_array[i].title + " (" + movie_array[i].year.toString() + ")");
    }
    var movie_options = {
      properties : {
        selection : {
          description : "Enter number of select movies",
          required : true,
          pattern : RegExp(regex_gen(movie_array.length))
        }
      }
    };
    prompt.get(movie_options, (err,res) => {
      if (err) console.log(err);
      var choices = [];
      res = res.selection.split(",").map(Number);
      choices = uniq(res);

      for(i=0;i < choices.length;++i) {
        request("http://www.omdbapi.com/?" + "i=" + movie_array[choices[i]].id + "&plot=short&r=json", displayInfo);
      }
    });
  }
  else {
    console.log("No results");
  }
});

// Generates a regex that takes a list of nuumbers in the form /a1,a2,a3,a4,a5...aN/ bounded by ints in [0,num]
function regex_gen(num) {
  array = num.toString().split("").map(Number);
  reg = [];
  for(var i = 1; i < array.length; ++i) {
    if (array[i] !== 1 || array.length ===2) {
      reg.push("[0-9]".repeat(i));
    }
  }
  num_left = array.length-1;
  if (array[0] == 1) {
    for(i = 1; i < array.length; ++i) {
      if (array[i] - 1 === 0) {
        reg.push(array.slice(0,i).join("") + "0" + "[0-9]".repeat(num_left-1));
        num_left -= 1;
      }
      else if(array[i] === 0) {
        num_left -= 1;
      }
      else {
        reg.push(array.slice(0,i).join("") + "[0-"+(array[i]-1).toString()+"]" + "[0-9]".repeat(num_left-1));
        num_left -= 1;
      }
    }
  }
  else {
    for(i = 0; i<array.length;++i) {
      if (array[i] - 1 === 0) {
        reg.push(array.slice(0,i).join("") + "0" + "[0-9]".repeat(num_left));
        num_left -= 1;
      }
      else if(array[i] === 0) {
        num_left -= 1;
      }
      else {
        if (num_left - 1 === 0) {num_left = 1;}
        reg.push(array.slice(0,i).join("") + "[0-"+(array[i]-1).toString()+"]" + "[0-9]".repeat(num_left));
        num_left -= 1;
      }
    }
  }
  reg = reg.join("|");
  return "^(" + reg + ")(,(" + reg + "))*$";
}

function uniq(a) {
    var seen = {};
    return a.filter(function(item) {
        return seen.hasOwnProperty(item) ? false : (seen[item] = true);
    });
}

function displayInfo(err,res) {
  if(err === null && res.statusCode === 200) {
    var data = JSON.parse(res.body);
    if (data.Response == 'True') {
      var replacements = {
        "%TITLE%" : data.Title,
        "%YEAR%" : data.Year,
        "%IMDB_RATING%" : data.imdbRating,
        "%SUMMARY%" : data.Plot
      };
      var output = "%TITLE% (%YEAR%) : \n\t%SUMMARY%\n\tRating on IMDb: %IMDB_RATING%";
      console.log(output.replace(/%\w+%/g, function(all) {
        return replacements[all] || all;
      }));
    }
  }
}

function main() {
  var init_options =  {
    properties : {
      search : {
        description : "Enter search terms",
        required : true
      }
    }
  };
  prompt.get(init_options, (err,res) => {
    emitter.emit("prompt-complete",res.search);
  });
}

main();
