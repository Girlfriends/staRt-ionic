/*global milestones:writable */

var practiceDirective = angular.module( 'practiceDirective' );
practiceDirective.factory('QuestScore', function QuestScoreFactory() {

	/* ---------------------------------------
  Purpose: Handles Quest scoring, milestone, and badging logic
  Ref: See https://github.com/ByunLab/staRt-ionic/wiki/Quest-Scoring
	*/

	// used if an existing fb profile does not already have
	// a highscoreQuest object
	function NewQuestHighScores() { // for new accts
		return  {
			mgibHx: [ {score: 0, date: Date.now()} ],
			hsibHx: [ {score: 10, date: Date.now()} ],
			mgiqHx: [ {score: 0, date: Date.now()} ],
			hsiqHx: [ {score: 20, date: Date.now()} ],
			streakHx: [ {score: 0, date: Date.now()} ],
			perfectBlockHx: [ {score: 0, date: Date.now()} ],
		};
	}

	// handles state for active profile's highscores and milestone thresholds
	function Milestones() {
		return  {
			// highscores: holds current in-game state of highscores
			// created from firebase highscore data
			highscores: {
				mgib: 0,
				hsib: 0,
				mgiq: 0,
				hsiq: 0,
				streak: 0,
				perfectBlock: 0,
			},
			// display: holds all the data (text, graphics, etc) for the sandbank display
			// it is created from the Sandbank constructor and updated from this.highscores
			display: undefined,
			// update: if a milestone is achieved during a Quest, this object is updated to hold highscore data to be push to firebase at the end of the quest
			update: {
				mgibHx: {},
				hsibHx: {},
				mgiqHx: {},
				hsiqHx: {},
				streakHx: {},
				perfectBlockHx: {},
			},
			shouldUpdateFirebase: false
		};
	}

	// handles state for active Quest score counters
	function QuestScores() {
		// sessionID is added by the controller
		return {
			block_display_score: 0, //user val
			block_goldCount: 0,
			block_score: 0, // lab val or difficulty score
			session_score: 0,
			display_score: 0,
			session_coins: {
				gold: 0,
				silver: 0,
				bronze: 0
			},
			streak: 0,
			performance: 0, // req'd for difficulty score
			changeDifficulty: 0, // req'd for difficulty score
			endOfBlock: false, // req'd by prepEndOfBlock()
			totalTrials: 0, // // req'd by prepEndOfBlock()
			isResumePrep: false // used by resume-session feature
		};
	}

	//handles state for Badges and Milestone Dialog Sequences
	function Badges() {
		return {
			onARoll: {
				flag: false,
				trials: 0,
				visible: false
			},
			newRecord: {
				flag: false,
				trials: 0,
				visible: false
			},
			cardsBlockEnd: {
				mgib: {
					template: 'achievement',
					title: 'Most Gold in Block!',
					imgClass: 'mgib',
					count: 0,
					imgUrl: '',
					btnText: 'Next',
				},
				hsib: {
					template: 'achievement',
					title: 'High Score in Block!',
					imgClass: 'hsib',
					count: 0,
					imgUrl: '',
					btnText: 'Next',
				},
				streak: {
					template: 'achievement',
					title: 'Gold Streak!',
					imgClass: 'streak',
					count: 0,
					imgUrl: '',
					btnText: 'Next',
				},
				perfectBlock: {
					template: 'achievement',
					title: 'Perfect Block!',
					imgClass: 'perfectBlock',
					count: 0,
					imgUrl: '',
					btnText: 'Next',
				},
				incrDiff: {
					template: 'note',
					title: 'Increasing Difficulty!',
					imgClass: 'incrDiff',
					bodyText: 'Watch for new words.',
					imgUrl: '',
					btnText: 'Next',
				},
				feedback: {
					template: 'note',
					title: 'Checkpoint',
					subtitle: '',
					imgClass: 'feedback',
					imgUrl: '',
					bodyText: 'Please provide qualitative feedback on the participant\'s performance over the last ten trials.',
					btnText: 'See Scores',
				},
				progSum: {
					template: 'progSum',
					title: 'Progress Summary',
					subtitle: '',
					imgClass: '',
					gold: 0,
					silver: 0,
					bronze: 0,
					btnText: 'Resume Quest',
				},
			},
			cardsQuestEnd: {
				mgiq: {
					flag: false,
					template: 'achievement',
					title: 'Most Gold in Quest!',
					imgClass: 'mgiq',
					count: 0,
					imgUrl: '',
					btnText: 'Next',
				},
				hsiq: {
					flag: false,
					template: 'achievement',
					title: 'High Score in Quest!',
					imgClass: 'hsiq',
					count: 0,
					imgUrl: '',
					btnText: 'Next',
				},
				endSum: {
					flag: true,
					template: 'endSum',
					title: 'Quest Complete!',
					imgClass: 'hooray',
					gold: 0,
					silver: 0,
					bronze: 0,
					btnText: 'See Final Score',
				},
				finalScore: {
					flag: true,
					template: 'finalScore',
					title: 'Quest Complete!',
					imgClass: 'hooray',
					subtitle: '',
					count: 0,
					btnText: 'Close',
				},
			},
			cardFlags: [], // flagged when a blockEnd milestone is achieved
			cardSeq: [],
			card: {}, // Holds the content to be displayed in the html template from badges.cardSeq[badges.cardIndex]
			cardIndex: -1,
			qtDialog: {
				isVisible: false, // is the Dialog Box Visible
				isBlockEnd: false, // used for Block-End seq
				isFinal: false // used for Quest-End sequence
			},
			qtDialogTemplate: { // used by html templates
				achievement: false, // used by end-of-block 'New Record' card
				note: false, // used by Qualitative Feedback Reminder note
				progSum: false, // used by "Progress Summary" card
				endSum: false, // used by 'Quest Complete Summary'
				finalScore: false, // used by 'Final Score'
			}
		};
	}

	function Sandbank() {
		return {
			hsib: {
				title: 'Most Points in Block',
				achieved: false,
				imgClass: 'hsib',
				min:10,
				highlightTest: 3,
				emptyText: 'Earn <span class="bold">10 points in a single block</span> to unlock this achievement.',
				score: 0, //should be same as milestones.highscores
				dateStr: '', //
				currentText: 'current block',
				currentValue: '{{scores.block_display_score}}',
				unit: 'points',
				highlight: false,
			},
			mgib: {
				title: 'Most Gold in Block',
				achieved: false,
				imgClass: 'mgib',
				min:0,
				highlightTest: 2,
				emptyText: 'Earn <span class="bold">a gold coin</span> to unlock this achievement.',
				score: 0,
				dateStr: '',
				currentText: 'current block',
				currentValue: '0',
				unit: 'coins',
				highlight: false,
			},
			streak: {
				title: 'Gold Streak',
				achieved: false,
				imgClass: 'streak',
				min:1,
				highlightTest: 1,
				emptyText: 'Earn <span class="bold">2 consecutive gold coins</span> to unlock this achievement.',
				score: 0,
				scoreClass: 'score-streak',
				scoreText: 'in a row',
				scoreTextClass: 'streak-text',
				dateStr: '',
				currentText: 'current streak',
				currentValue: '0',
				unit: 'coins',
				highlight: false,
			},
			hsiq: {
				title: 'Most Points in Quest',
				achieved: false,
				imgClass: 'hsiq',
				min: 20,
				highlightTest: 10,
				emptyText: 'Earn <span class="bold">20 points</span> to unlock this achievement.',
				score: 0,
				dateStr: '',
				currentText: 'current quest',
				currentValue: '0',
				unit: 'points',
				highlight: false,
			},
			mgiq: {
				title: 'Most Gold in Quest',
				achieved: false,
				imgClass: 'mgiq',
				min:0,
				highlightTest: 5,
				emptyText: 'Earn <span class="bold">a gold coin</span> to unlock this achievement.',
				score: 0,
				dateStr: '',
				currentText: 'current quest',
				currentValue: '0',
				unit: 'coins',
				highlight: false,
			},
			perfectBlock: {
				title: 'Perfect Block',
				achieved: false,
				imgClass: 'perfectBlock',
				min: 0,
				highlightTest: 1,
				emptyText: 'Earn <span class="bold">10 gold coins in a block</span> to unlock this achievement.',
				score: 0,
				scoreClass: 'score-perfectB',
				scoreText: 'times',
				scoreTextClass: 'perfectB-text',
				dateStr: '',
				currentText: 'current quest: ',
				currentValue: '0',
				unit: ' blocks',
				highlight: false,
			},
		};
	} // end sandbank constructor


	// ==============================================
	// INITS ------------------------
	var initCoinCounter = function(count, questCoins){
		var numStack = count/10;
		for(var i=0; i<numStack; i++) {
			var stack = { id: i };
			questCoins.push(stack);
		}
	};

	var initNewHighScores = function(highscores) {
		highscores = undefined;
		highscores = new NewQuestHighScores();
		return highscores;
	};

	var initMilestones = function(highscores) {
		milestones = undefined;
		milestones = new Milestones();

		// highscores data --------------------------
		var mapHighscores = function(milestone) {
			var highscoresArr = highscores[milestone + 'Hx'].map(function(item) {
				return item.score;
			});
			return(Math.max.apply(Math, highscoresArr));
		};

		for (var key in milestones.highscores) {
			milestones.highscores[key] = mapHighscores(key);
		}

		console.log(milestones);
		// display data --------------------------
		var sandbank = new Sandbank();

		var displayTemp = {};

		for (var key in highscores) {
			var keyName = key.slice(0, -2);
			var keyIdxNewest = highscores[key].length -1;
			displayTemp[keyName] = highscores[key][keyIdxNewest];
			displayTemp[keyName].dateStr = new Date(displayTemp[keyName].date).toLocaleDateString();
		}
		for (var item in sandbank) {
			sandbank[item].score = displayTemp[item].score;
			sandbank[item].dateStr = displayTemp[item].dateStr;
			if (sandbank[item].score > sandbank[item].min) {
				sandbank[item].achieved = true;
			}
		}

		milestones.display = sandbank;

		// console.log(milestones.highscores);
		return milestones;
	};

	var initScores = function(scores, sessionCount) {
		scores = undefined;
		scores = new QuestScores();
		scores.totalTrials = sessionCount;
		return scores;
	};

	var initBadges = function(badges) {
		badges = undefined;
		badges = new Badges();
		return badges;
	};


	// ==============================================
	// RATING EVENT HELPERS ------------------------

	// -- called by questRating() (each trial)  ------
	// maps coin value to color or userScore value
	var mapCoinColor = {
		3: 'gold',
		2: 'silver',
		1: 'bronze'
	};

	// for mapping coinColor values to values used for BITS research
	var mapLabScore = {
		3: 1,
		2: .5,
		1: 0
	};

	var updateCoinGraphic = function(data, currentWordIdx) {
		//console.log('currentWordIdx: ' + currentWordIdx);

		//graphics use zero-based idx
		var wordIdx = currentWordIdx - 1;
		var stackIdx = (Math.floor(wordIdx/10));
		var stackID = 'div#stack' + stackIdx;
		var coinID = 'g#coin-' + (wordIdx - (stackIdx * 10));

		// queries for css & svg
		var coinQ = stackID + ' ' + coinID;
		var sideQ = coinQ + ' g.side';
		var topQ = coinQ + ' ellipse.top';
		var coin = angular.element( document.querySelector( coinQ ) );
		var side = angular.element( document.querySelector( sideQ ) );
		var top = angular.element( document.querySelector( topQ ) );
		side.addClass('coinSide-' + data);
		top.addClass('coinTop-' +  data);
		coin.removeClass('hidden');
		coin.addClass('animated', 'bounce');

		//console.log(stackID + ', ' + coinID);
	};


	// ==============================================
	// MILESTONE HELPERS ---------------------------

	// updates milestone props in badges object
	function updateMilestoneCard(msType, badges, msProp, count) {
		var hasFlag = badges.cardFlags.includes(msProp);

		if (msType === 'block') {
			if(!hasFlag) { badges.cardFlags.push(msProp); }
			badges.cardsBlockEnd[msProp].count = count;
		} else if (msType === 'quest') {
			badges.cardsQuestEnd[msProp].flag = true;
			badges.cardsQuestEnd[msProp].count = count;
		}
	}

	// updates milestone props in badges object
	function updateSummaryCards(badges, typeProp, msProp, coinSum ) {
		badges[typeProp][msProp].gold = coinSum.gold;
		badges[typeProp][msProp].silver = coinSum.silver;
		badges[typeProp][msProp].bronze = coinSum.bronze;
	}

	// updates milestone props in in $scope.milestones to be saved to firebase at end of Quest
	function updateMilestoneRecord(milestones, msProp, newMilestone) {
		milestones.highscores[msProp] = newMilestone;

		// for fb update
		var msHx = [msProp] + 'Hx';
		milestones.update[msHx].score = newMilestone;
		milestones.update[msHx].date = Date.now();
		milestones.shouldUpdateFirebase = true;

		// for sandbank
		milestones.display[msProp].score = newMilestone;
		milestones.display[msProp].dateStr = 'TODAY!';
		milestones.display[msProp].achieved = true;
	}


	// ==============================================
	// END-OF-BLOCK HELPERS (dialog cards and resets)

	// called by resetForNewBlock(), nextCard()
	function clearFlags(flagObj) {
		for (var prop in flagObj) {
		  if (flagObj.hasOwnProperty(prop)) {
				flagObj[prop] = false;
		  }
		}
	}

	// used for badges.onARoll & badges.newRecord only
	function resetBadges(badges, badge) {
		badges[badge].flag = false;
		badges[badge].trials = 0;
		badges[badge].visible = false;
	}

	// ==============================================
	// ADAPTIVE DIFFICULTY HELPER
	function checkDifficulty(scores, badges) {
		// update performance
		scores.performance = scores.block_score/10;

		// update changeDiff
		var increase_difficulty_threshold = 0.8;
		var decrease_difficulty_threshold = 0.5;

		var should_increase_difficulty = function() {
			return scores.performance >= increase_difficulty_threshold;
		};
		var should_decrease_difficulty = function() {
			return scores.performance <= decrease_difficulty_threshold;
		};

		if (should_increase_difficulty()) {
			badges.cardFlags.push('incrDiff');
			scores.changeDifficulty = 1;
		} else if (should_decrease_difficulty()) {
			scores.changeDifficulty = -1;
		} else {
			scores.changeDifficulty = 0;
		}
	}

	// ==============================================
	// BADGE HELPERS (in-game stickers) -------------
	function displayBadgeOnARoll(badges) {
		badges.newRecord.visible = false;
		badges.onARoll.flag = true;
		badges.onARoll.visible = true;
		badges.onARoll.trials++;
	}

	function displayBadgeNewRecord(badges) {
		if(badges.onARoll.flag === false ||
			badges.onARoll.trials > 2)
		{ // switch badges
			badges.onARoll.visible = false;
			badges.newRecord.flag = true;
			badges.newRecord.visible = true;
			badges.newRecord.trials++;
		} else {
			badges.newRecord.flag = true;
		}
	}


	// ==============================================
	// DIALOG BOX HELPERS ------------------------
	function prepEndOfBlock(badges) {
		var msFlags = badges.cardFlags; // array of milestones achieved in block

		// adds card template per milestone achieved in block + feedback card
		msFlags.forEach( function(ms) {
			var msCard = badges.cardsBlockEnd[ms];
			badges.cardSeq.push(msCard);
		});

		if(badges.qtDialog.isFinal) {
			if(badges.cardsQuestEnd.mgiq.flag) {
				badges.cardSeq.push( badges.cardsQuestEnd.mgiq );
			}
			if(badges.cardsQuestEnd.hsiq.flag) {
				badges.cardSeq.push( badges.cardsQuestEnd.hsiq );
			}
			badges.cardSeq.push( badges.cardsBlockEnd.feedback );
			badges.cardSeq.push(badges.cardsQuestEnd.endSum);
			badges.cardSeq.push( badges.cardsQuestEnd.finalScore );

		} else { // normal end-of-block
			badges.cardSeq.push( badges.cardsBlockEnd.feedback );
			badges.cardSeq.push( badges.cardsBlockEnd.progSum );
		}

		nextCard(badges);
	}

	// ==============================================
	// SANDBANK ------------------------
	// Updates the Sandbank scores an sets highlights
	// Called each time the user opens the Sandbank drawer
	function updateSandbank(scores, milestones) {
		var updateObj = {
			hsib: scores.block_display_score,
			mgib: scores.block_goldCount,
			streak: scores.streak,
			hsiq: scores.display_score,
			mgiq: scores.session_coins.gold,
			perfectBlock: milestones.highscores.perfectBlock,
		};

		for (var sb_item in milestones.display) {
			milestones.display[sb_item].currentValue = updateObj[sb_item];

			if(milestones.display[sb_item].currentValue > 0) {
				if( milestones.display[sb_item].currentValue > (milestones.display[sb_item].score - milestones.display[sb_item].highlightTest)) {
					milestones.display[sb_item].highlight = true;
				} else {
					milestones.display[sb_item].highlight = false;
				}
			}
		}
		//console.log(milestones.display);
	}


	// ==============================================
	// MAIN PROCS ===================================

	// called by controller: $scope.dialogResume()
	var resetForNewBlock = function (scores, badges) {
		clearFlags(badges.qtDialog);
		clearFlags(badges.qtDialogTemplate);

		// scoresObj
		scores.block_score = 0;
		scores.block_display_score = 0;
		scores.block_goldCount = 0;
		scores.endOfBlock = false;

		// milestones: no need to reset

		// badges: in-game stickers
		resetBadges(badges, 'newRecord');

		// badges: achievement cards
		badges.cardIndex = -1;
		badges.cardFlags = [];
		badges.cardSeq = [];
		badges.card = {};
	};

	// called by $scope.dialogNext();
	var nextCard = function(badges) {
		//console.log('nextCard is callled');
		clearFlags(badges.qtDialogTemplate);

		badges.cardIndex++;

		var currentCard = badges.cardSeq[badges.cardIndex];
		var template = currentCard.template;

		var populateCard = function(fieldArr) {
			fieldArr.forEach(function(field) {
				badges.card[field] = currentCard[field];
			});
		};
		//add common template fields here
		var commonFields = ['title', 'imgClass', 'btnText'];
		populateCard(commonFields);

		if(template === 'achievement') {
			badges.qtDialogTemplate.achievement = true;
			badges.card.count = currentCard.count;
		} else if (template === 'note') {
			badges.qtDialogTemplate.note = true;
			badges.card.bodyText = currentCard.bodyText;
		} else if (template === 'progSum') {
			badges.qtDialogTemplate.progSum = true;
			var progSumFields = ['subtitle', 'gold', 'silver', 'bronze'];
			populateCard(progSumFields);
		} else if (template === 'endSum') {
			badges.qtDialogTemplate.endSum = true;
			var endSumFields = ['subtitle', 'gold', 'silver', 'bronze'];
			populateCard(endSumFields);
		} else if (template === 'finalScore') {
			badges.qtDialogTemplate.finalScore = true;
			badges.card.count = currentCard.count;
		}


		if(badges.cardIndex >= 0) {
			badges.qtDialog.isVisible = true;
		}
	}; // advanceEndOfBlock

	//called by questRating() only
	var checkUpdateMilestones = function(scores, milestones, badges, currentWordIdx) {

		// checked every trial -----------------------------
		if(scores.streak > 2)	{
			displayBadgeOnARoll(badges);
		} else {
			resetBadges(badges, 'onARoll');
		}
		if(scores.streak < 2 && badges.newRecord.flag)	{
			badges.newRecord.visible = true;
		}

		// mgib: most gold in block
		if( scores.block_goldCount > milestones.highscores.mgib) {
			console.log('NEW RECORD: MOST GOLD IN BLOCK');
			displayBadgeNewRecord(badges);
			var mgibNew = scores.block_goldCount;
			updateMilestoneRecord(milestones, 'mgib', mgibNew);
			updateMilestoneCard('block', badges, 'mgib', mgibNew);
		}

		// hsib: high score in block
		if( scores.block_display_score > milestones.highscores.hsib) {
			console.log('NEW RECORD: HIGH SCORE IN BLOCK');
			displayBadgeNewRecord(badges);
			var hsibNew = scores.block_display_score;
			updateMilestoneRecord(milestones, 'hsib', hsibNew);
			updateMilestoneCard('block', badges, 'hsib', hsibNew);
		}

		// hsiq: high score in quest
		if( scores.display_score > milestones.highscores.hsiq) {
			console.log('NEW RECORD: HIGH SCORE IN QUEST');
			displayBadgeNewRecord(badges);
			var hsiqNew = scores.display_score;
			updateMilestoneRecord(milestones, 'hsiq', hsiqNew);
			updateMilestoneCard('quest', badges, 'hsiq', hsiqNew);
		}

		// mgiq: most gold in quest
		if( scores.session_coins.gold > milestones.highscores.mgiq) {
			console.log('NEW RECORD: MOST GOLD IN QUEST');
			displayBadgeNewRecord(badges);
			var mgiqNew = scores.session_coins.gold;
			updateMilestoneRecord(milestones, 'mgiq', mgiqNew);
			updateMilestoneCard('quest', badges, 'mgiq', mgiqNew);
		}

		// streak: consecutive golds
		if( scores.streak > milestones.highscores.streak ) {
			console.log('NEW RECORD: STREAK');
			displayBadgeNewRecord(badges);
			var streakNew = scores.streak;
			updateMilestoneRecord(milestones, 'streak', streakNew);
			updateMilestoneCard('block', badges, 'streak', streakNew);
		}

		if(scores.block_goldCount == 10) {
			console.log('PERFECT BLOCK');
			// no badge, achieved at end of block
			var perfectBlockNew = milestones.highscores.perfectBlock + 1;
			updateMilestoneRecord(milestones, 'perfectBlock', perfectBlockNew);
			updateMilestoneCard('block', badges, 'perfectBlock', perfectBlockNew);
		}

		// checked at end of block -----------------------------
		if( scores.endOfBlock ) {

			var finalBlock = (currentWordIdx > (scores.totalTrials -10)) ? true : false;

			if(!finalBlock) { checkDifficulty(scores, badges); }

			//updateSummaryCards()
			badges.qtDialog.isBlockEnd = true;
			badges.cardsBlockEnd.progSum.subtitle = currentWordIdx + ' / ' + scores.totalTrials + ' complete';
			var coinSum = scores.session_coins;
			updateSummaryCards(badges, 'cardsBlockEnd', 'progSum', coinSum );

			if(finalBlock){
				badges.qtDialog.isFinal = true;
				updateSummaryCards(badges, 'cardsQuestEnd', 'endSum', coinSum );
				badges.cardsQuestEnd.finalScore.count = scores.display_score;
			}

			if(scores.isResumePrep){
				// skips the dialog box prep if we are resuming a saved session
				resetForNewBlock(scores, badges);
			} else {
				prepEndOfBlock(badges);
			}
		}
	}; //end checkUpdateMilestones

	//--------------------------------------------------
	// Called by each rating button press. Updates scores and coins.
	var questRating = function(data, scores, milestones, currentWordIdx, badges) {

		// update the coin
		updateCoinGraphic(data, currentWordIdx);

		// update score data
		scores.display_score += data;
		scores.block_display_score += data;

		if (mapCoinColor[data] == 'gold') {
			scores.block_goldCount += 1;
		}

		scores.session_coins[mapCoinColor[data]]++;

		// update lab score counters
		scores.block_score += mapLabScore[data]; // labScore
		scores.session_score += mapLabScore[data]; // labScore

		if (mapCoinColor[data] == 'gold') {
			scores.streak++;
		} else {
			scores.streak = 0;
			resetBadges(badges, 'onARoll');
		}

		// check for end of block
		scores.endOfBlock = (currentWordIdx % 10 == 0 && currentWordIdx > 0) ? true : false;

		checkUpdateMilestones(scores, milestones, badges, currentWordIdx);
	}; // end questRating()

	return {
		initCoinCounter: initCoinCounter,
		initNewHighScores: initNewHighScores,
		initMilestones: initMilestones,
		initScores: initScores,
		initBadges: initBadges,
		questRating: questRating,
		nextCard: nextCard,
		resetForNewBlock: resetForNewBlock,
		updateSandbank: updateSandbank,
	};
});
