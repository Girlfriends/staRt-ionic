[
	{
		"idx": 0,
		"sref": "p01s1",
		"coinRef":"p01",
		"nav": {
			"id": "p01s1",
			"page": 1,
			"scene": 1
		},

		"template":"waveNone.html",
		
		"bgImg": {
			"status": "done",
			"url":"img/tutorial/oldSlides/p01s1.png"
		},
	
		"LRow1": {
			"items": [
				"<img src='img/tutorial/hello-p01s1.png' height='50' width='182'>",
				"<p>This tutorial will show you how to use the staRt wave to practice your 'r' sounds.</p>",
				"You should have an <span class='txtBold-blue'>external microphone </span> plugged into your iPad.",
				"Please allow yourself <span class='txtBold-blueDark'>15 minutes</span> to complete the tutorial."
			]
		},

		"pic": {
			"imgAbs": true,
			"img":"img/tutorial/char-p01s1.png",
			"h": "370px",
			"w": "346px",
			"top": "105px",
			"left":"475px"
		},
		
		"input": {
			"txt":"Let's go!",
			"next": "p01s2"
		}
	},


	{
		"idx": 1,
		"sref": "p01s2",
		"coinRef":"p01",
		"nav": {
			"id": "p01s2",
			"page": 1,
			"scene": 2
		},

		"template":"waveSingle.html",
		
		"bgImg": {
			"status": "done",
			"url":"img/tutorial/oldSlides/p01s2.png"
		},

		"header": {
			"head": true,
			"txt": "<span class='txtBold'>StaRt makes a picture of your speech soundsin real-time.</span> "
		},

		"LRow1": {
			"wave": {
				"lpcLive": true,
				"labelTitle": "Your Speech Wave"
			}
		},
		
		"LRow2": {
			"items": [
				"See how the wave moves around when you talk?"
			]
		},

		"RRow1": {
			"txt": "Speak into the microphone."
		},

		"RRow1": {
			"txtSquish": false,
			"items":[
				"<p>Speak into the microphone.</p>"
			]
		},

		"pic": {
			"img":"img/tutorial/starMic.png",
			"h": "260px",
			"w": "265px",
			"top": "0px",
			"left": "0px"
		},
		
		"input": {
			"txt":"Next",
			"next": "p01s3"
		}
	},


	{
		"idx": 2,
		"sref": "p01s3",
		"coinRef":"p01",
		"nav": {
			"id": "p01s3",
			"page": 1,
			"scene": 3
		},

		"template":"waveSingle.html",
		
		"bgImg": {
			"status": "done",
			"url":"img/tutorial/oldSlides/p01s3.png"
		},

		"header": {
			"head": true,
			"txt": "<span class='txtBold'>We are going to focus on the bumps or <span class='txtBold-blueDark'>peaks</span> in your wave.</span>"
		},

		"LRow1": {
			"wave": {
				"lpcLive": true,
				"labelTitle": "Your Speech Wave"
			}
		},

		"LRow2": {
			"items": [
				"<p>See how the <span class='txtBold'>peaks</span> move around when you talk?</p>"
			]
		},

		"RRow1": {
			"txtSquish": false,
			"items":[
				"<p>Peaks create your wave’s shape.</p>"
			]
		},

		"pic": {
			"img":"img/tutorial/starPoint.png",
			"h": "255px",
			"w": "235px",
			"top": "0px",
			"left":"0px"
		},
		
		"input": {
			"txt":"Next",
			"next": "p01s4"
		}
	},


	{
		"idx": 3,
		"sref": "p01s4",
		"coinRef":"p01",
		"nav": {
			"id": "p01s4",
			"page": 1,
			"scene": 4
		},

		"template":"waveSingle.html",
		
		"bgImg": {
			"status": "done",
			"url":"img/tutorial/oldSlides/p01s4.png"
		},
		
		"header": {
			"txt": "The dark lines are there to help you find the peaks in your wave, but ..."
		},

		"LRow1": {
			"lpc": true,
			"labelTitle": "Your Speech Wave"
		},

		"LRow1": {
			"wave": {
				"lpcLive": true,
				"labelTitle": "Your Speech Wave"
			}
		},

		"LRow2": {
			"txt":"Focus on the overall shape of the wave. <span class='txtBold'>In staRt, peaks are more important than lines.</span>"
		},

		"LRow2": {
			"items": [
				"<p>Focus on the overall shape of the wave.</p>",
				"<p class='txtBold'>In staRt, peaks are more important than lines.</p>"
			]
		},

		"RRow1": {
			"txtSquish": false,
			"items":[
				"<p>sometimes you will see a peak without a line, or a line without a peak.</p>"
			]
		},

		"pic": {
			"img":"img/tutorial/starPoint.png",
			"h": "255px",
			"w": "235px",
			"top": "0px",
			"left":"0px"
		},
		
		"input": {
			"txt":"Next",
			"next": "p01s5"
		}
	},
	

	{
		"id": "p01s5",
		"sref": "p01s5",
		"coinRef":"p01",
		"nav": {
			"page": 1,
			"scene": 5
		},

		"template":"waveNone.html",
		
		"bgImg": {
			"status": "done",
			"url":"img/tutorial/oldSlides/p01s5.png"
		},

		"header": {
			"txt": [
				"<span class='txtBold'>You’ve completed the first step of the tutorial.</span>"
			]
		},

		"LRow1": {
			"items": [
				"As you complete each step, you’ll receive one sand dollar in the sand bank.",
				"<img src='img/tutorial/p01s5-coins.png' height='69' width='420'>",
				"To return to a tutorial section, just touch the corresponding sand dollar."
			]
		},
			
		"pic": {
			"imgAbs": true,
			"img":"img/tutorial/char-p01s5.png",
			"h": "350px",
			"w": "400px",
			"top": "125px",
			"left":"425px"
		},
		
		"input": {
			"txt":"Next",
			"next":"p02s1"
		}
	}

]