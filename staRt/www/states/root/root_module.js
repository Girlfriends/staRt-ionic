'use strict';

( function(  )
{
	var root = angular.module( 'root',
	[
		'LocalForageModule',
		'firebaseService',
		'notifyingService',
		'profileService',
		'startStateService',
		'uploadService',
		'lpcDirective',
		'ngCordova',
		'auto',
		'freePlay',
		'profiles',
		'resources',
		'syllables',
		'tutorial',
		'words'
	] );

	root.config( function( $stateProvider )
	{
		$stateProvider.state( 'root',
		{
			url: '/',
			views:
			{
				'app-view':
				{
					templateUrl: 'states/root/root_template.html',
					controller: 'RootController as root'
				}
			}
			//abstract: true
		});
	} );

} )(  );
