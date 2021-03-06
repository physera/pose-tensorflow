import argparse
import json
import subprocess
import os
from imageio import imread, imwrite
import numpy as np
from PIL import Image, ExifTags

from .util import config
from pose_tensorflow.nnet.predict import (
    setup_pose_prediction,
    argmax_pose_predict,
    extract_cnn_output,
)
from .draw import draw_annotations


def data_to_input(data):
    return np.expand_dims(data, axis=0).astype(float)


def resize_image(input_image):
    # Make the max dimension 400
    im = Image.open(input_image)
    for orientation in ExifTags.TAGS.keys():
        if ExifTags.TAGS[orientation] == 'Orientation':
            break
    exif = im._getexif() if hasattr(im, '_getexif') else None
    if exif:
        exif = dict(exif.items())
        # Be careful in case exif doesn't have orientation.
        orientation = exif.get(orientation)
        if orientation == 3:
            im = im.transpose(Image.ROTATE_180)
        elif orientation == 6:
            im = im.transpose(Image.ROTATE_270)
        elif orientation == 8:
            im = im.transpose(Image.ROTATE_90)

    im.thumbnail([400, 400])
    f, e = os.path.splitext(input_image)
    new_image = f + ".thumbnail" + e
    im.save(new_image)
    return new_image

# Load and setup CNN part detector
__cfg, __sess, __inputs, __outputs = None, None, None, None

def setup():
    global __cfg, __sess, __inputs, __outputs
    __dirname = os.path.dirname(__file__)
    __cfg = config.load_config(os.path.join(__dirname, "pose_cfg.yaml"))
    __sess, __inputs, __outputs = setup_pose_prediction(__cfg)


def process_single_image(input_image):
    if __cfg is None:
        setup()

    # Read image from file
    image = imread(input_image, pilmode='RGB')
    image_dims = image.shape

    image_batch = data_to_input(image)

    # Compute prediction with the CNN
    outputs_np = __sess.run(__outputs, feed_dict={__inputs: image_batch})
    scmap, locref, _ = extract_cnn_output(outputs_np, __cfg)

    # Extract maximum scoring location from the heatmap, assume 1 person
    pose = argmax_pose_predict(scmap, locref, __cfg.stride)

    # Jsonify the results
    result = []
    for pidx, name in enumerate(__cfg.all_joints_names):
        name = __cfg.all_joints_names[pidx]
        parts = __cfg.all_joints[pidx]
        for side, part in enumerate(parts):
            result.append({
                "name": name,
                "side": side,
                "x": pose[part, 0] / image_dims[1],
                "y": pose[part, 1] / image_dims[0],
                "score": pose[part, 2],
            })

    return result
