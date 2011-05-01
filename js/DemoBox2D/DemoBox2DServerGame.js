/**
File:
	DemoBox2DServerGame.js
Created By:
	Mario Gonzalez
Project:
	DemoBox2D
Abstract:
	This is a demo of using Box2d.js with RealTimeMultiplayerNode.js
 	The box2d.js world creation and other things in this demo, are shamelessly lifted from the https://github.com/HBehrens/box2d.js examples
Basic Usage:
 	demoServerGame = new DemoBox2D.DemoServerGame();
 	demoServerGame.startGameClock();
Version:
	1.0
*/
(function(){
	var BOX2D = require("./lib/box2d.js");
	DemoBox2D.DemoServerGame = function() {
		DemoBox2D.DemoServerGame.superclass.constructor.call(this);

		this.setGameDuration( DemoBox2D.Constants.GAME_DURATION );
		this.setupBox2d();
		return this;
	};

	DemoBox2D.DemoServerGame.prototype = {
		_world							: null,
		_velocityIterationsPerSecond    : 200,
		_positionIterationsPerSecond	: 300,

		/**
		 * Map RealtimeMultiplayerGame.Constants.CMDS to functions
		 * If ServerNetChannel does not contain a function, it will check to see if it is a special function which the delegate wants to catch
		 * If it is set, it will call that CMD on its delegate
		 */
		setupCmdMap: function() {
			DemoBox2D.DemoServerGame.superclass.setupCmdMap.call(this);
			this.cmdMap[RealtimeMultiplayerGame.Constants.CMDS.PLAYER_UPDATE] = this.shouldUpdatePlayer;
		},

		setupBox2d: function() {
			DemoBox2D.Constants.GAME_WIDTH /= 32;
			DemoBox2D.Constants.GAME_HEIGHT /= 32;
			DemoBox2D.Constants.ENTITY_BOX_SIZE /= 32;

			this.createBox2dWorld();
			this._world.DestroyBody(this._wallBottom);

			for(var i = 0; i < DemoBox2D.Constants.MAX_CIRCLES; i ++) {
				var x = (DemoBox2D.Constants.GAME_WIDTH/2) + Math.sin(i/5);
				var y = i*-DemoBox2D.Constants.ENTITY_BOX_SIZE*4;//DemoBox2D.Constants.ENTITY_BOX_SIZE - (i/32 * DemoBox2D.Constants.ENTITY_BOX_SIZE)
				this.spawn(x, y, 0);
			}
		},

		createBox2dWorld: function() {
			var m_world = new BOX2D.b2World(new BOX2D.b2Vec2(0, 10), true);
			var m_physScale = 1;
			m_world.SetWarmStarting(true);

			// Create border of boxes
			var wall = new BOX2D.b2PolygonShape();
			var wallBd = new BOX2D.b2BodyDef();

			// Left
			wallBd.position.Set(-1, DemoBox2D.Constants.GAME_HEIGHT/2);
			wall.SetAsBox(1, DemoBox2D.Constants.GAME_HEIGHT/2);
			this._wallLeft = m_world.CreateBody(wallBd);
			this._wallLeft.CreateFixture2(wall);
			// Right
			wallBd.position.Set(DemoBox2D.Constants.GAME_WIDTH + 1, DemoBox2D.Constants.GAME_HEIGHT/2);
			wall.SetAsBox(1, DemoBox2D.Constants.GAME_HEIGHT/2);
			this._wallRight = m_world.CreateBody(wallBd);
			this._wallRight.CreateFixture2(wall);
			// BOTTOM
			wallBd.position.Set(DemoBox2D.Constants.GAME_WIDTH/2 * DemoBox2D.Constants.PHYSICS_SCALE, DemoBox2D.Constants.GAME_HEIGHT+1);
			wall.SetAsBox(DemoBox2D.Constants.GAME_WIDTH/2, 1);
			this._wallTop = m_world.CreateBody(wallBd);
			this._wallTop.CreateFixture2(wall);
			// TOP
			wallBd.position.Set(DemoBox2D.Constants.GAME_WIDTH/2 * DemoBox2D.Constants.PHYSICS_SCALE - 1, 1);
			wall.SetAsBox(DemoBox2D.Constants.GAME_WIDTH/2, 1);
			this._wallBottom = m_world.CreateBody(wallBd);
			this._wallBottom.CreateFixture2(wall);

			this._world = m_world;
		},

		createBall: function(world, x, y, radius) {
			radius = radius || 2;

			var fixtureDef = new BOX2D.b2FixtureDef();
			fixtureDef.shape = new BOX2D.b2CircleShape(radius);
			fixtureDef.friction = 0.4;
			fixtureDef.restitution = 0.6;
			fixtureDef.density = 1.0;

			var ballBd = new BOX2D.b2BodyDef();
			ballBd.type = b2Body.b2_dynamicBody;
			ballBd.position.Set(x,y);
			var body = world.CreateBody(ballBd);
			body.CreateFixture(fixtureDef);
			return body;
		},

		spawn: function(x, y, a) {
			var bodyDef = new BOX2D.b2BodyDef();
			bodyDef.type = BOX2D.b2Body.b2_dynamicBody;
			bodyDef.position.Set(x, y);
			bodyDef.angle = a;

			var body = this._world.CreateBody(bodyDef);
			body.w = DemoBox2D.Constants.ENTITY_BOX_SIZE;
			body.h = DemoBox2D.Constants.ENTITY_BOX_SIZE;
			var shape = new BOX2D.b2PolygonShape.AsBox(body.w, body.h);
			var fixtureDef = new BOX2D.b2FixtureDef();
			fixtureDef.restitution = 0.0;
			fixtureDef.density = 1.0;//10.0;
			fixtureDef.friction = 1.0;
			fixtureDef.shape = shape;
			body.CreateFixture(fixtureDef);

			// Create the entity for it in RealTimeMultiplayerNodeJS
			var circleEntity = new DemoBox2D.CircleEntity( this.getNextEntityID(), RealtimeMultiplayerGame.Constants.SERVER_SETTING.CLIENT_ID );
			circleEntity.setBox2DBody( body );

			this.fieldController.addEntity( circleEntity );

			return body;
		},


		/**
		 * Updates the game
		 * Creates a WorldEntityDescription which it sends to NetChannel
		 */
		tick: function() {
			var delta = 16 / 1000;
			this.step( delta );

			if(this.gameTick % 50 === 0) {
				this.resetRandomBody();
			}
			// Note we call superclass's implementation after we're done
			DemoBox2D.DemoServerGame.superclass.tick.call(this);
		},

		/**
		 * Resets an entity and drops it from the sky
		 */
		resetRandomBody: function() {
			// Retrieve a random key, and use it to retreive an entity
			var allEntities = this.fieldController.getEntities();
			var randomKeyIndex = Math.floor(Math.random() * allEntities._keys.length);
			var entity = allEntities.objectForKey( allEntities._keys[randomKeyIndex] );

			var x = Math.random() * DemoBox2D.Constants.GAME_WIDTH + DemoBox2D.Constants.ENTITY_BOX_SIZE;
			var y = Math.random() * - 15;
			entity.getBox2DBody().SetPosition( new BOX2D.b2Vec2( x, y ) );
		},

		step: function( delta ) {
			this._world.ClearForces();
//			var delta = (typeof delta == "undefined") ? 1/this._fps : delta;
			this._world.Step(delta, delta * this._velocityIterationsPerSecond, delta * this._positionIterationsPerSecond);
		},

		shouldAddPlayer: function( aClientid, data ) {
//			this.createPlayerEntity( this.getNextEntityID(), aClientid);
		},

		/**
		 * @inheritDoc
		 */
		shouldUpdatePlayer: function( aClientid, data ) {
			var pos = new BOX2D.b2Vec2( data.payload.x/32, data.payload.y/32 );

			// Loop through each entity, retrieve it's Box2D body, and apply an impulse towards the mouse position a user clicked
			this.fieldController.getEntities().forEach( function(key, entity) {
				var body = entity.getBox2DBody();
				var bodyPosition = body.GetPosition();
				var angle = Math.atan2( pos.y - bodyPosition.y, pos.x - bodyPosition.x );
				var force = 10;
				var impulse = new BOX2D.b2Vec2( Math.cos(angle) * force, Math.sin(angle) * force);
				body.ApplyImpulse( impulse, bodyPosition );
			}, this );
		},

		shouldRemovePlayer: function( aClientid ) {
//			DemoBox2D.DemoServerGame.superclass.shouldRemovePlayer.call( this, aClientid );
//			console.log("DEMO::REMOVEPLAYER");
		}
	};

	// extend RealtimeMultiplayerGame.AbstractServerGame
	RealtimeMultiplayerGame.extend(DemoBox2D.DemoServerGame, RealtimeMultiplayerGame.AbstractServerGame, null);
})()