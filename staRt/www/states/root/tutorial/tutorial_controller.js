'use strict';

( function(  )
{
	var tutorial = angular.module( 'tutorial' );

	tutorial.controller('TutorialController', 
		function($scope, $timeout, $localForage, StartUIState, $rootScope, $state, $http, $stateParams, firstPanelData) 
		{
			$scope.p01data = firstPanelData.data;
			$scope.p01s1 = $scope.p01data[0];
			$scope.p01s2 = $scope.p01data[1];
			$scope.p01s3 = $scope.p01data[2];
			$scope.p01s4 = $scope.p01data[3];
			$scope.p01s5 = $scope.p01data[4];
			console.log('tut controller firstPanelData:',firstPanelData.data);	

			//get data for tutorial_template.html 
			$http.get('states/root/tutorial/tutorialData/coinData.json').success(function(data){
				$scope.coinData = data;
			});

			$http.get('states/root/tutorial/tutorialData/p02data.js').success(function(data)
			{
				$scope.p02data = data;
				$scope.p02s1 = $scope.p02data[0];
				$scope.p02s2 = $scope.p02data[1];
			});

			$http.get('states/root/tutorial/tutorialData/p03data.js').success(function(data)
			{
				$scope.p03data = data;
				$scope.p03s1 = $scope.p03data[0];
				$scope.p03s2 = $scope.p03data[1];
				$scope.p03s3 = $scope.p03data[2];
			});

			$http.get('states/root/tutorial/tutorialData/p04data.js').success(function(data)
			{
				$scope.p04data = data;
				$scope.p04s1 = $scope.p04data[0];
				$scope.p04s2 = $scope.p04data[1];
				$scope.p04s3 = $scope.p04data[2];
			});

			$http.get('states/root/tutorial/tutorialData/p05data.js').success(function(data)
			{
				$scope.p05data = data;
				$scope.p05s1 = $scope.p05data[0];
				$scope.p05s2 = $scope.p05data[1];
				$scope.p05s3 = $scope.p05data[2];
				$scope.p05s4 = $scope.p05data[3];
				$scope.p05s5 = $scope.p05data[4];
			});

		console.log('TutorialController here!');
	} 	// end of controller constructor body
	); // end of controller constructor fx
} )(  );
