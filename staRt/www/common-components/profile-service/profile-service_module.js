/* eslint-disable no-undef */
var profileService = angular.module('profileService', [ 'firebaseService', 'notifyingService', 'utilitiesService' ]);

profileService.factory('ProfileService', function($rootScope, $state, $localForage, $http, $cordovaDialogs, FirebaseService, NotifyingService, StartServerService, UtilitiesService)
{
	function newUserProfile() {
		if (!FirebaseService.loggedIn()) { return null; }

		return {
			accountId: FirebaseService.userId(),
			name: undefined,
			email: FirebaseService.userEmail(),
			age: undefined,
			heightFeet: undefined,
			heightInches: undefined,
			gender: undefined,
			uuid: UtilitiesService.guid(),

			// Profile cumulative statistics
			allSessionTime: 0, // Milliseconds logged in for this profile
			allFreeplayTime: 0, // Milliseconds spend in free play for this profile
			allQuestTime: 0, // Milliseconds spend in a syllable/word quest
			allTrialsCompleted: 0, // Total number of trials elicited and scored for a given profile
			allTrialsCorrect: 0, // Total number of 'points' accumulated for a profile (good>1, okay>0.5, try again>0)
			percentTrialsCorrect: 0, // 100 * correct / completed
			nQuestsInitiated: 0, // total number of quests initiated
			nQuestsCompleted: 0, // total number of quests completed
			nLongSessionsCompleted: 0, // total number of times a user is logged in for at least 10 minutes
			nBiofeedbackSessionsCompleted: 0, // number of session trials completed with biofeedback
			nNonBiofeedbackSessionsCompleted: 0, // number of session trials completed without biofeedback

			// Profile component statistics
			nWordQuizComplete: 0, // number of times Word Quiz has been completed
			nSyllableQuizComplete: 0, // number of times Syllable Quiz has been completed
			nTutorialComplete: 0, // number of times the tutorial has been completed
			nIntroComplete: 0, // number of times intro sequence has been completed
			nFormalTreatmentComplete: 0, // number of times the formal treatment has been completed

			// Other profile statistics
			brandNew: true,
			formalTester: false, // don't forget to make this false
			firstSessionTimestamp: null, // Unix timestamp of first trial
			lastSessionTimestamp: null, // Unix timestamp of most recent trial
			creationTimestamp: Date.now(), // Unix timestamp profile creation
			lastLoginTimestamp: Date.now(), // Unix time of last login
			inProcessSession: null, // Ratings etc. in the current recording for a formal on-protocol session
			inProcessSessionState: null, // Extra data for the state of the resumed on protocol session

			recordingSessionHistory: [],
			highscoresQuest: { // used by practice-directive_questScoring.js
				mgibHx: [ {score: 0, date: Date.now()} ],
				hsibHx: [ {score: 10, date: Date.now()} ],
				mgiqHx: [ {score: 0, date: Date.now()} ],
				hsiqHx: [ {score: 20, date: Date.now()} ],
				streakHx: [ {score: 0, date: Date.now()} ],
				perfectBlockHx: [ {score: 0, date: Date.now()} ],
			},
		};
	}

	var normsData;
	var filterOrderData;
	var norms;
	var filterOrder;
	var profilesInterfaceState;

	$http.get('data/F3r_norms_Lee_et_al_1999.csv').then(function(res)
	{
		// Set up norms data
		normsData = res;
		norms = UtilitiesService.parseCSV(normsData.data).slice(1);
	});

	$http.get('data/filter_norms.csv').then(function(res)
	{
		filterOrderData = res;
		filterOrder = UtilitiesService.parseCSV(filterOrderData.data).slice(1);
	});

	function loadProfilesInterfaceState() {
		return $localForage.keys().then(function(keys, err) {
			var profilePromises = [];
			keys.forEach(function(key) {
				profilePromises.push( $localForage.getItem(key) );
			});

			if (profilePromises.length === 0) {
				return {
					currentProfileUUID : null
				};
			}

			// eslint-disable-next-line no-undef
			return Promise.all(profilePromises).then( function(result) {
				var retVal = {};
				for (var i=0; i<result.length; i++) {
					retVal[keys[i]] = result[i];
				}
				return retVal;
			});
		});
	}

	function _getAllProfiles() {
		if (!FirebaseService.loggedIn()) { return Promise.resolve(null); }
		return FirebaseService.db().collection('profiles')
			.where('accountId', '==', FirebaseService.userId())
			.get()
			.then(function (querySnapshot) {
				var profiles = [];
				querySnapshot.forEach(function (doc) {
					profiles.push(doc.data());
				});
				return profiles;
			})
			.catch(function (error) {
				console.log('Error fetching profiles data');
				return null;
			});
	}
	function _goIfCurrentProfileSelected(destination) {
		return profilesInterfaceState.then( function(res) {
			var currentId = res['currentProfileUUID'];
			if (!!currentId || destination == 'root.profiles') {
				$state.go(destination);
			} else {
				$cordovaDialogs.alert('You must select a participant to use staRt.', 'Select Participant');
			}
		});
	}

	function _getCurrentProfile() {
		return profilesInterfaceState.then( function(res) {
			var currentId = res['currentProfileUUID'];
			var currentProfile = null;
			if (currentId) {
				return FirebaseService.db().collection('profiles')
					.where('uuid', '==', currentId)
					.get()
					.then(function (querySnapshot) {
						querySnapshot.forEach(function (doc) {
							currentProfile = doc.data(); // there should only be one...
						});
						return currentProfile;
					})
					.catch(function (err) {
						console.log(err);
						return null;
					});
			} else {
				return Promise.resolve(null);
			}
		});
	}

	function _saveProfile(profile) {
		NotifyingService.notify('profile-saved', profile);
		return FirebaseService.db().collection('profiles')
			.doc(profile.uuid)
			.set(profile);
	}

	function _lookupDefaultFilterOrder(profile) {
		if (profile.age !== undefined &&
      profile.heightFeet !== undefined &&
      profile.heightInches !== undefined &&
      profile.age !== undefined) {
			var gender = profile.gender;
			gender = gender === 'Male' ? 'M' : 'F';
			var ageBit = profile.age >= 15 ? '1' : '0';
			var heightBit = profile.heightFeet * 12 + profile.heightInches >= 64 ? '1' : '0';

			var filterRow = filterOrder.find(function (row) {
				return row[0] === gender && row[1] === ageBit && row[2] === heightBit;
			});
			if (filterRow) return parseInt(filterRow[3]);
			return 35;
		} else {
			return 35;
		}
	}

	profilesInterfaceState = loadProfilesInterfaceState();

	function _reloadProfilesInterfaceState() {
		profilesInterfaceState = loadProfilesInterfaceState();
	}

	function _getRecordingSessionDataById(profile, sessionid) {
		var recordingSessions = profile.recordingSessionHistory.filter(function (recordingSession) {return recordingSession.id === sessionid;});
		// This can happen when the user tries to resume a session that they recently quit out of.
		// The problem is that the session is still uploading to firebase.
		if (recordingSessions.length == 0) {
			$cordovaDialogs.alert(
				'This recording session cannot be resumed. Please wait a few seconds and try again.',
				'Cannot resume session.',
				'Okay'
			);
		}
		else if (recordingSessions.length > 1) {
			console.log('ERROR: There should only be one recording session per id.');
		}
		else {
			return recordingSessions[0];
		}
	}


	function _resumeNormalRecordingSession(profile, sessionid) {
		var recordingSession = _getRecordingSessionDataById(profile, sessionid);
		if (UtilitiesService.recordingSessionIsComplete(recordingSession)) {
			// Ideally we don't even show the resume button for completed sessions.
			$cordovaDialogs.alert(
				'You cannot resume a session that has already been completed.',
				'Cannot resume session.',
				'Okay'
			);
			return;
		}
		if (recordingSession.isFormalSession) {
			$cordovaDialogs.alert(
				'You cannot resume an on protocol session through this page. You must resume on protocol sessions by going to Profiles and clicking Start Session.',
				'Cannot resume session.',
				'Okay'
			);
			return;
		}
		var is_quest = recordingSession.probe == 'quest';
		var is_quiz = recordingSession.probe && !is_quest; // probe is set to true if its a quiz, and 'quest' if its a quest.
		$rootScope.sessionToResume = recordingSession;
		if (is_quest) {
			$state.go('root.words');
		}
		if (is_quiz) {
			$state.go('root.auto');
		}
	}

	return {

		resumeNormalRecordingSession: function(profile, sessionid) {
			return _resumeNormalRecordingSession(profile, sessionid);
		},

		clearInProgressSessionForCurrentProfile: function()
		{
			return this.runTransactionForCurrentProfile(function(handle, doc, t) {
				t.update(handle, {
					inProcessSession: null,
					inProcessSessionState: null
				});
			});
		},

		reloadProfilesInterfaceState : function () {return  _reloadProfilesInterfaceState(); },

		getAllProfiles: function()
		{
			return _getAllProfiles();
		},

		deleteAllProfiles: function()
		{
			if (!FirebaseService.loggedIn()) { return Promise.resolve(null); }

			return FirebaseService.db().collection('profiles')
				.where('accountId', '==', FirebaseService.userId())
				.get()
				.then(function (querySnapshot) {
					var deletes = [];
					querySnapshot.forEach(function (doc) {
						deletes.push(doc.ref.delete());
					});
					return Promise.all(deletes);
				});
		},

		getCurrentProfile: function()
		{
			return _getCurrentProfile();
		},

		goIfCurrentProfileSelected : function (destination)
		{
			return _goIfCurrentProfileSelected(destination);
		},

		getProfileTransactionHandle: function(profileData)
		{
			var profileUUID = profileData.uuid;
			return FirebaseService.db().collection('profiles').doc(profileUUID);
		},

		getProfileWithUUID: function(profileUUID) {
			return FirebaseService.db().collection('profiles')
				.where('uuid', '==', profileUUID)
				.get()
				.then(function (querySnapshot) {
					var currentProfile = null;
					querySnapshot.forEach(function (doc) {
						currentProfile = doc.data(); // there should only be one...
					});
					return currentProfile;
				})
				.catch(function (err) {
					console.log(err);
					return null;
				});
		},

		getRecordingsForProfile: function(profile, cb) {
			if (window.AudioPlugin !== undefined) {
				var pluginRecordingsCallback = function(recordings) {
					cb(recordings);
				};
				window.AudioPlugin.recordingsForProfile (
					profile,
					pluginRecordingsCallback,
					function() {cb([]);}
				);
			} else {
				cb([]);
			}
		},

		setCurrentProfileUUID: function(profileUUID)
		{
			return profilesInterfaceState.then( function (res) {
				if (profileUUID !== res['currentProfileUUID']) {
					NotifyingService.notify('will-set-current-profile-uuid', profileUUID);
				}
				res['currentProfileUUID'] = profileUUID;
				$localForage.setItem('currentProfileUUID', profileUUID);
				return res['currentProfileUUID'];
			});
		},


		// @param profileHandle - A proflie handle as returned by getProfileTransactionHandle
		// @param transactionFunction - A function that takes as its first argument a profile
		//  handle (profileHandle), as its second argument the profile doc itself (profileDoc)
		//  and as its third the transaction that can be used with the handle to update the
		//  profile. Call transaction.update(profileHandle, { <key>: <value> }) for each update
		//  transaction. As an example:
		//    ProfileService.runTransactionFor(profileHandle, function(handle, doc, t) {
		//      t.update(handle, { counter: doc.data().counter + 1 });
		//    });
		runTransaction: function(profileHandle, transactionFunction) {
			return FirebaseService.db().runTransaction(function(transaction) {
				return transaction.get(profileHandle).then(function(profileDoc) {
					return transactionFunction(profileHandle, profileDoc, transaction);
				});
			});
		},

		// @param transactionFunction - A function that takes as its first argument a profile
		//  handle (profileHandle), as its second argument the profile doc itself (profileDoc)
		//  and as its third the transaction that can be used with the handle to update the
		//  profile. Call transaction.update(profileHandle, { <key>: <value> }) for each update
		//  transaction. As an example:
		//    ProfileService.runTransactionForCurrentProfile(function(handle, doc, t) {
		//      t.update(handle, { counter: doc.data().counter + 1 });
		//    });
		runTransactionForCurrentProfile: function(transactionFunction) {
			return this.getCurrentProfile().then((function(profile) {
				if (profile) {
					var handle = this.getProfileTransactionHandle(profile);
					if (handle) {
						return this.runTransaction(handle, transactionFunction);
					}
				}
				return Promise.reject('No current profile to run a transaction for.');
			}).bind(this));
		},

		saveProfile: function(profile)
		{
			if (!profile.lpcOrder) {
				profile.lpcOrder = _lookupDefaultFilterOrder(profile);
			}
			return _saveProfile(profile);
		},

		createProfile: function()
		{
			return newUserProfile();
		},

		deleteProfile: function(profile)
		{
			return FirebaseService.db().collection('profiles')
				.doc(profile.uuid)
				.delete()
				.then(_getAllProfiles);
		},

		lookupDefaultF3: function(profile) {
			if (profile.age && profile.gender) {
				var age = profile.age;
				age = age <= 5 ? 5 : age;
				age = age >= 19 ? '19+' : age;
				age = age.toString();
				var gender = profile.gender;
				gender = gender === 'Male' ? 'M' : 'F';

				var normRow = norms.find(function (row) {
					return row[0] === gender && row[1] === age;
				});
				if (normRow) return parseInt(normRow[2]);
				return 0;
			} else {
				return 0;
			}
		},

		lookupDefaultFilterOrder: function(profile) {
			return _lookupDefaultFilterOrder(profile);
		}
	};

});
