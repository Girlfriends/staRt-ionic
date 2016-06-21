'use strict';

( function(  )
{
	var profiles = angular.module( 'profiles' );

	profiles.controller('ProfilesController', function($scope, $timeout, $localForage, StartUIState, $rootScope, $state)
	{
		console.log('ProfilesController here!');

		var users = [
			{
				name: 'Eeyore',
				age: 16,
				height: '5\'2\"',
				sex: 'Male'
			},
			{
				name: 'Piglet',
				age: 4,
				height: '3\'2\"',
				sex: 'Male'
			},
			{
				name: 'Pooh',
				age: 26,
				height: '7\'2"',
				sex: 'Male'
			}
		]

		$localForage.getItem('profiles').then(function(res)
		{
			if (res)
			{
				$scope.profiles = users;
				console.log($scope.profiles);
			}
			else
			{
				$localForage.setItem('profiles', users);
				$scope.profiles = users;
			}
		});

		$scope.logCurrentUser = function()
		{
			console.log($scope.data.currentUser);
		}

		// $scope.currentUser = {};

		$scope.data = { 
			currentUser: 
			{
				name: 'Pooh',
				age: 26,
				height: '7\'2\"',
				sex: 'Male'
			}
		}

		// $scope.currentUser = {
		// 	name: 'Pooh',
		// 	age: 26,
		// 	height: '7\'2\"',
		// 	sex: 'Male'
		// }
	});

} )(  );