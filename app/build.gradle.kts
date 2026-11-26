plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
}

val signingPath = providers.environmentVariable("YISHU_SIGNING_FILE").orNull
abstract class BundleVipAssets : DefaultTask() {
    @get:InputDirectory
    @get:PathSensitive(PathSensitivity.RELATIVE)
    abstract val website: DirectoryProperty

    @get:OutputDirectory
    abstract val outputDirectory: DirectoryProperty

    @get:javax.inject.Inject
    abstract val files: FileSystemOperations

    @TaskAction
    fun bundle() {
        files.sync {
            from(website) { exclude("server/**") }
            into(outputDirectory.dir("vip-web"))
        }
    }
}

val syncVipAssets by tasks.registering(BundleVipAssets::class) {
    website.set(rootProject.layout.projectDirectory.dir("sites/yishu/dist"))
}
androidComponents.onVariants {
    it.sources.assets?.addGeneratedSourceDirectory(syncVipAssets, BundleVipAssets::outputDirectory)
}

android {
    namespace = "org.yishu.app"
    compileSdk = 37

    defaultConfig {
        applicationId = "org.yishu.app"
        minSdk = 26
        targetSdk = 37
        versionCode = 5
        versionName = "1.3.1"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (signingPath != null) {
            create("release") {
                storeFile = file(signingPath)
                storePassword = providers.environmentVariable("YISHU_SIGNING_PASSWORD").get()
                keyAlias = providers.environmentVariable("YISHU_SIGNING_ALIAS").get()
                keyPassword = providers.environmentVariable("YISHU_KEY_PASSWORD").get()
            }
        }
    }

    buildTypes {
        debug { applicationIdSuffix = ".debug" }
        release { signingConfig = signingConfigs.findByName("release") }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures { compose = true }
    packaging.resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
}

dependencies {
    implementation(project(":domain"))
    val composeBom = platform("androidx.compose:compose-bom:2025.10.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.9.4")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.9.4")
    implementation("androidx.datastore:datastore-preferences:1.1.7")
    implementation("androidx.room:room-runtime:2.8.4")
    implementation("androidx.room:room-ktx:2.8.4")
    ksp("androidx.room:room-compiler:2.8.4")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    // Compose's older transitive Espresso uses a hidden input API removed in Android 17.
    androidTestImplementation("androidx.test.espresso:espresso-core:3.7.0")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}

ksp { arg("room.schemaLocation", "$projectDir/schemas") }
