//
//  AudioPlugin.h
//  AudioPlugin
//
//  Created by Sam Tarakajian on 5/16/16.
//  Copyright © 2016 Girlfriends Labs. All rights reserved.
//

#import <Foundation/Foundation.h>
#import <Cordova/CDV.h>

@interface AudioPlugin : CDVPlugin {}
- (void)startAudio:(CDVInvokedUrlCommand *)command;
- (void)stopAudio:(CDVInvokedUrlCommand *)command;
- (void)getLPCCoefficients:(CDVInvokedUrlCommand *)command;
- (void)startRecording:(CDVInvokedUrlCommand *)command;
- (void)stopRecording:(CDVInvokedUrlCommand *)command;
- (void)isRecording:(CDVInvokedUrlCommand *)command;
- (void)recordingsForAccount:(CDVInvokedUrlCommand *)command;
- (void)deleteRecording:(CDVInvokedUrlCommand *)command;
- (void)deleteAllRecordings:(CDVInvokedUrlCommand *)command;
- (void)getLPCOrder:(CDVInvokedUrlCommand *)command;
- (void)setLPCOrder:(CDVInvokedUrlCommand *)command;
@end
